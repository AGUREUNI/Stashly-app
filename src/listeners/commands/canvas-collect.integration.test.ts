import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// installation-store をモック（plan-manager がインポートする prisma を差し替え）
vi.mock('../../services/installation-store', () => ({
  prisma: {
    workspaceSubscription: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { handleCanvasCollect, _clearUserRateLimitForTest } from './canvas-collect';
import { createMockClient } from '../../test-helpers/mock-client';
import { createMockCommand } from '../../test-helpers/mock-command';
import { lockManager } from '../../services/lock-manager';
import { _clearLocaleCacheForTest } from '../../i18n';
import { AppError } from '../../types';

/**
 * 統合テスト: handleCanvasCollect
 *
 * 実サービス（parseCommand, collectMessages, upsertCanvas 等）を使い、
 * Slack WebClient だけモックする真の統合テスト。
 */

/** Bot参加チャンネルを返すデフォルトモック */
function setupBotChannels(client: any, channelIds: string[]) {
  client.users.conversations.mockResolvedValue({
    channels: channelIds.map(id => ({ id })),
    response_metadata: {},
  });
}

/** conversations.history にリアクション付きメッセージを返す */
function setupHistoryWithReactions(client: any, emoji: string, count: number, channelId = 'C_CURRENT') {
  const messages = Array.from({ length: count }, (_, i) => ({
    ts: `1700000${String(i).padStart(3, '0')}.000000`,
    reactions: [{ name: emoji, count: 1, users: ['U_OTHER'] }],
  }));
  client.conversations.history.mockResolvedValue({
    messages,
    response_metadata: {},
  });
}

/** conversations.history に空を返す */
function setupEmptyHistory(client: any) {
  client.conversations.history.mockResolvedValue({
    messages: [],
    response_metadata: {},
  });
}

describe('handleCanvasCollect 統合テスト', () => {
  let client: any;
  let ack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = createMockClient();
    ack = vi.fn().mockResolvedValue(undefined);
    lockManager._clearForTest();
    _clearLocaleCacheForTest();
    _clearUserRateLimitForTest();
    vi.unstubAllEnvs();

    // デフォルト: 英語locale
    client.users.info.mockResolvedValue({ user: { locale: 'en-US' } });
    // デフォルト: Bot参加チャンネル = C_CURRENT
    setupBotChannels(client, ['C_CURRENT']);
    // デフォルト: チャンネル名
    client.conversations.info.mockResolvedValue({ channel: { name: 'general' } });
  });

  // ─── Happy paths ───────────────────────────────────────

  it('#1 絵文字のみ → 新規Canvas作成（全フロー）', async () => {
    const command = createMockCommand({ text: ':thumbsup:' });
    setupHistoryWithReactions(client, 'thumbsup', 3);
    // files.list → 既存Canvas無し（デフォルトで空）

    await handleCanvasCollect({ command, ack, client });

    // ack が呼ばれた
    expect(ack).toHaveBeenCalledOnce();
    // postEphemeral: 収集中 + 完了 = 2回
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(2);

    // 収集中通知
    const collectingCall = client.chat.postEphemeral.mock.calls[0][0];
    expect(collectingCall.channel).toBe('C_CURRENT');
    expect(collectingCall.user).toBe('U_USER');

    // Canvas新規作成が呼ばれた
    expect(client.canvases.create).toHaveBeenCalledOnce();
    const createArgs = client.canvases.create.mock.calls[0][0];
    expect(createArgs.title).toBe(':thumbsup: Collection Log');
    expect(createArgs.channel_id).toBe('C_CURRENT');

    // canvases.edit は呼ばれない（新規作成だから）
    expect(client.canvases.edit).not.toHaveBeenCalled();

    // 完了通知にCanvas URLが含まれる
    const completionCall = client.chat.postEphemeral.mock.calls[1][0];
    expect(completionCall.text).toContain('3');
  });

  it('#2 既存Canvas → 追記モード', async () => {
    const command = createMockCommand({ text: ':star:' });
    setupHistoryWithReactions(client, 'star', 2);

    // files.list → 既存Canvasあり
    client.files.list.mockResolvedValue({
      files: [{ id: 'F_EXISTING', title: ':star: Collection Log', updated: 1000 }],
      response_metadata: {},
    });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // canvases.create は呼ばれない
    expect(client.canvases.create).not.toHaveBeenCalled();
    // canvases.edit (insert_at_end) が呼ばれた
    expect(client.canvases.edit).toHaveBeenCalledOnce();
    const editArgs = client.canvases.edit.mock.calls[0][0];
    expect(editArgs.canvas_id).toBe('F_EXISTING');
    expect(editArgs.changes[0].operation).toBe('insert_at_end');
  });

  it('#8 絵文字+チャンネル+期間の複合コマンド', async () => {
    const command = createMockCommand({
      text: ':check: <#CCH100001|marketing> <#CCH200002|sales> last 7 days',
    });
    // Bot参加チャンネル: 全3チャンネル
    setupBotChannels(client, ['C_CURRENT', 'CCH100001', 'CCH200002']);

    // 各チャンネルのhistory
    client.conversations.history.mockResolvedValue({
      messages: [
        { ts: '1700000001.000000', reactions: [{ name: 'check', count: 1, users: ['U1'] }] },
      ],
      response_metadata: {},
    });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // conversations.history が3チャンネル分呼ばれた
    expect(client.conversations.history).toHaveBeenCalledTimes(3);

    // oldest パラメータが設定されている（期間指定あり）
    const historyCall = client.conversations.history.mock.calls[0][0];
    expect(historyCall.oldest).toBeDefined();

    // Canvas作成 or 追記が呼ばれた
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(2);
  });

  it('#15 実行チャンネルを重複指定 → Set重複排除で1回だけ収集', async () => {
    // channel_id と <#...|...> を同じIDにして重複を発生させる
    const command = createMockCommand({
      text: ':thumbsup: <#CCURR0001|general>',
      channel_id: 'CCURR0001',
    });
    setupBotChannels(client, ['CCURR0001']);
    setupHistoryWithReactions(client, 'thumbsup', 2);

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // CCURR0001 が重複排除されて1回だけhistory呼び出し
    expect(client.conversations.history).toHaveBeenCalledTimes(1);
    // 完了通知あり
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(2);
  });

  // ─── No results / empty states ─────────────────────────

  it('#3 マッチなし → 該当なし通知、Canvas未作成', async () => {
    const command = createMockCommand({ text: ':thumbsup:' });
    setupEmptyHistory(client);

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // 収集中 + 該当なし = 2回
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(2);

    // 該当なし通知
    const noResultCall = client.chat.postEphemeral.mock.calls[1][0];
    expect(noResultCall.text).toContain('No matching');

    // Canvas作成・編集されない
    expect(client.canvases.create).not.toHaveBeenCalled();
    expect(client.canvases.edit).not.toHaveBeenCalled();
  });

  it('#10 空入力 → NO_EMOJIエラー、ロック未取得', async () => {
    const command = createMockCommand({ text: '' });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // エラーメッセージ1回
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(1);
    const errorCall = client.chat.postEphemeral.mock.calls[0][0];
    expect(errorCall.text).toContain('emoji');

    // ロック取得されていない → 収集中通知も無い
    expect(client.conversations.history).not.toHaveBeenCalled();
  });

  it('#11 不正な絵文字形式 → PARSE_ERRORエラー表示', async () => {
    const command = createMockCommand({ text: 'notanemoji' });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(1);
    const errorCall = client.chat.postEphemeral.mock.calls[0][0];
    expect(errorCall.text).toContain('notanemoji');
    expect(errorCall.text).toContain(':emoji:');
  });

  // ─── Lock management ───────────────────────────────────

  it('#4 ロック競合 → 収集スキップ、競合メッセージ表示', async () => {
    const command = createMockCommand({ text: ':thumbsup:' });
    setupHistoryWithReactions(client, 'thumbsup', 3);

    // 先にロックを取得（マルチテナント対応で teamId:emoji 形式）
    lockManager.acquire('T_TEAM:thumbsup');

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // ロック競合のみ = 1回（ロック取得が「収集中」送信の前に移動されたため）
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(1);
    const lockCall = client.chat.postEphemeral.mock.calls[0][0];
    expect(lockCall.text).toContain('thumbsup');
    expect(lockCall.text).toContain('gathering');

    // 収集・Canvas操作は行われない
    expect(client.canvases.create).not.toHaveBeenCalled();
  });

  it('#14 例外発生時のロック解放（finally句）', async () => {
    const command = createMockCommand({ text: ':thumbsup:' });
    setupBotChannels(client, ['C_CURRENT']);

    // conversations.history で例外を投げる
    client.conversations.history.mockRejectedValue(
      Object.assign(new Error('api_error'), { data: { error: 'internal_error' } }),
    );

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // ロックが解放されている → 同じ絵文字で再度ロック取得できる
    expect(lockManager.acquire('T_TEAM:thumbsup')).toBe(true);
  });

  // ─── Channel resolution ────────────────────────────────

  it('#5 チャンネル名未検出 → エラー表示、収集スキップ', async () => {
    const command = createMockCommand({ text: ':thumbsup: #nonexistent' });
    // conversations.list で空を返す → チャンネル名解決失敗
    client.conversations.list.mockResolvedValue({
      channels: [],
      response_metadata: {},
    });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // エラーメッセージ1回
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(1);
    const errorCall = client.chat.postEphemeral.mock.calls[0][0];
    expect(errorCall.text).toContain('#nonexistent');

    // 収集は行われない
    expect(client.conversations.history).not.toHaveBeenCalled();
  });

  it('#6 Bot未参加チャンネル → skippedChannels警告付き完了通知', async () => {
    const command = createMockCommand({
      text: ':thumbsup: <#CNOJOIN01|private-ch>',
    });
    // C_CURRENT のみBot参加（CNOJOIN01 は未参加）
    setupBotChannels(client, ['C_CURRENT']);
    setupHistoryWithReactions(client, 'thumbsup', 2);
    // CNOJOIN01 のチャンネル名取得
    client.conversations.info.mockImplementation((args: any) => {
      if (args.channel === 'CNOJOIN01') {
        return Promise.resolve({ channel: { name: 'private-ch' } });
      }
      return Promise.resolve({ channel: { name: 'general' } });
    });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // 収集中 + 完了 = 2回
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(2);
    // 完了通知にskippedChannels情報がある（blocks内にprivate-chが含まれる）
    const completionCall = client.chat.postEphemeral.mock.calls[1][0];
    const blocksJson = JSON.stringify(completionCall.blocks);
    expect(blocksJson).toContain('private-ch');
  });

  // ─── API errors ────────────────────────────────────────

  it('#7 missing_scope致命的エラー → 翻訳済みエラー表示', async () => {
    const command = createMockCommand({ text: ':thumbsup:' });
    setupBotChannels(client, ['C_CURRENT']);

    // conversations.history で missing_scope エラー
    client.conversations.history.mockRejectedValue(
      Object.assign(new Error('missing_scope'), { data: { error: 'missing_scope' } }),
    );

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // 収集中 + エラー = 2回
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(2);
    const errorCall = client.chat.postEphemeral.mock.calls[1][0];
    expect(errorCall.text).toContain('permission');
  });

  it('#12 非AppError例外 → genericFallbackメッセージ表示', async () => {
    const command = createMockCommand({ text: ':thumbsup:' });
    setupBotChannels(client, ['C_CURRENT']);

    // conversations.history で普通のError（AppErrorではない）
    // ただし callWithRetry が classifyError で AppError に変換するので、
    // getUserLocale を壊して非AppErrorを発生させる
    client.users.info.mockResolvedValue({ user: { locale: 'en-US' } });

    // collectMessages内のgetBotChannelsでエラーを出す
    // users.conversations で非Slack形式のエラーを投げる
    client.users.conversations.mockRejectedValue(new TypeError('Cannot read properties'));

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // 収集中 + エラー = 2回
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(2);
    const errorCall = client.chat.postEphemeral.mock.calls[1][0];
    expect(errorCall.text).toContain('unexpected error');
  });

  // ─── Localization ──────────────────────────────────────

  it('#13 日本語locale → 日本語メッセージ、Canvasタイトルは英語固定', async () => {
    const command = createMockCommand({ text: ':thumbsup:' });
    // 日本語locale
    client.users.info.mockResolvedValue({ user: { locale: 'ja-JP' } });
    setupHistoryWithReactions(client, 'thumbsup', 2);

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();

    // 収集中通知が日本語
    const collectingCall = client.chat.postEphemeral.mock.calls[0][0];
    expect(collectingCall.text).toContain('収集中');

    // 完了通知が日本語
    const completionCall = client.chat.postEphemeral.mock.calls[1][0];
    expect(completionCall.text).toContain('収集しました');

    // Canvasタイトルは英語固定
    const createArgs = client.canvases.create.mock.calls[0][0];
    expect(createArgs.title).toBe(':thumbsup: Collection Log');
  });

  // ─── Limits ────────────────────────────────────────────

  it('#9 500件超過 → 上限警告付き完了通知、Canvas作成は正常', async () => {
    const command = createMockCommand({ text: ':thumbsup:' });

    // 501件のメッセージを返す
    const messages = Array.from({ length: 501 }, (_, i) => ({
      ts: `1700${String(i).padStart(6, '0')}.000000`,
      reactions: [{ name: 'thumbsup', count: 1, users: ['U1'] }],
    }));
    client.conversations.history.mockResolvedValue({
      messages,
      response_metadata: {},
    });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // Canvas作成は正常に行われる
    expect(client.canvases.create).toHaveBeenCalledOnce();
    // 完了通知にlimitWarningが含まれる
    const completionCall = client.chat.postEphemeral.mock.calls[1][0];
    const blocksJson = JSON.stringify(completionCall.blocks);
    expect(blocksJson).toContain('500');
  });

  // ─── Plan limits ───────────────────────────────────────

  it('#16 Free プラン: 複数チャンネル指定 → planMultiChannel エラー（収集スキップ）', async () => {
    vi.stubEnv('PLAN_OVERRIDE', 'free');
    const command = createMockCommand({ text: ':thumbsup: <#CCH100001|other-ch> last 7 days' });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // エラーメッセージ1回のみ（収集中通知なし）
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(1);
    const errorCall = client.chat.postEphemeral.mock.calls[0][0];
    expect(errorCall.text).toContain('Pro');

    // 収集・Canvas操作は行われない
    expect(client.conversations.history).not.toHaveBeenCalled();
    expect(client.canvases.create).not.toHaveBeenCalled();
  });

  it('#17 Free プラン: 期間未指定（全期間）→ planPeriodTooLong エラー', async () => {
    vi.stubEnv('PLAN_OVERRIDE', 'free');
    const command = createMockCommand({ text: ':thumbsup:' });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(1);
    const errorCall = client.chat.postEphemeral.mock.calls[0][0];
    expect(errorCall.text).toContain('Pro');

    // 収集は行われない
    expect(client.conversations.history).not.toHaveBeenCalled();
  });

  it('#18 Free プラン: 31日以上の期間 → planPeriodTooLong エラー', async () => {
    vi.stubEnv('PLAN_OVERRIDE', 'free');
    const command = createMockCommand({ text: ':thumbsup: last 60 days' });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(1);
    const errorCall = client.chat.postEphemeral.mock.calls[0][0];
    expect(errorCall.text).toContain('Pro');
    expect(client.conversations.history).not.toHaveBeenCalled();
  });

  it('#19 Free プラン: 既存Canvas あり → planCanvasAppend エラー', async () => {
    vi.stubEnv('PLAN_OVERRIDE', 'free');
    const command = createMockCommand({ text: ':thumbsup: last 7 days' });
    setupHistoryWithReactions(client, 'thumbsup', 3);

    // 既存 Canvas あり
    client.files.list.mockResolvedValue({
      files: [{ id: 'F_EXISTING', title: ':thumbsup: Collection Log', updated: 1000 }],
      response_metadata: {},
    });

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // 収集中 + エラー = 2回
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(2);
    const errorCall = client.chat.postEphemeral.mock.calls[1][0];
    expect(errorCall.text).toContain('Pro');

    // Canvas作成・追記は行われない
    expect(client.canvases.create).not.toHaveBeenCalled();
    expect(client.canvases.edit).not.toHaveBeenCalled();
  });

  it('#20 Free プラン: 既存Canvas なし・30日以内 → 新規作成OK', async () => {
    vi.stubEnv('PLAN_OVERRIDE', 'free');
    const command = createMockCommand({ text: ':thumbsup: last 7 days' });
    setupHistoryWithReactions(client, 'thumbsup', 3);
    // 既存 Canvas なし（デフォルト）

    await handleCanvasCollect({ command, ack, client });

    expect(ack).toHaveBeenCalledOnce();
    // 収集中 + 完了 = 2回
    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(2);
    // Canvas 新規作成
    expect(client.canvases.create).toHaveBeenCalledOnce();
    const createArgs = client.canvases.create.mock.calls[0][0];
    expect(createArgs.title).toBe(':thumbsup: Collection Log');
  });
});
