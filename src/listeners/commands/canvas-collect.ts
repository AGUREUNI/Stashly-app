import type { App } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';
import type { KnownBlock } from '@slack/types';
import { parseCommand } from '../../services/command-parser';
import { collectMessages, resolveChannelNames } from '../../services/message-collector';
import { buildMarkdown, buildAppendMarkdown } from '../../services/markdown-builder';
import { upsertCanvas } from '../../services/canvas-manager';
import { lockManager } from '../../services/lock-manager';
import { getWorkspacePlan, checkPlanLimits, PLAN_LIMITS, UPGRADE_URL } from '../../services/plan-manager';
import { callWithRetry } from '../../services/slack-api';
import { AppError } from '../../types';
import { getUserLocale, t } from '../../i18n';
import type { SupportedLocale, MessageKey } from '../../i18n';
import {
  buildCollectingBlocks,
  buildCompletionBlocks,
  buildNoResultBlocks,
  buildErrorBlocks,
  buildLockConflictBlocks,
} from '../../services/block-builder';

/** per-user レートリミット管理クラス */
class UserRateLimiter {
  private readonly lastExecution = new Map<string, number>();
  private readonly cooldownMs: number;
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(cooldownMs: number) {
    this.cooldownMs = cooldownMs;
    this.cleanupInterval = setInterval(() => this.cleanup(), cooldownMs);
  }

  /** クールダウン中なら true */
  isLimited(userId: string): boolean {
    const last = this.lastExecution.get(userId);
    return last !== undefined && Date.now() - last < this.cooldownMs;
  }

  /** 実行時刻を記録 */
  record(userId: string): void {
    this.lastExecution.set(userId, Date.now());
  }

  /** テスト用: 全エントリをクリア */
  _clearForTest(): void {
    this.lastExecution.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [userId, lastExec] of this.lastExecution) {
      if (now - lastExec > this.cooldownMs) {
        this.lastExecution.delete(userId);
      }
    }
  }
}

const userRateLimiter = new UserRateLimiter(60 * 1000);

/** テスト用: per-userレートリミットをクリア */
export function _clearUserRateLimitForTest(): void {
  userRateLimiter._clearForTest();
}

/**
 * /canvas-collect コマンドのハンドラ本体
 * テストから直接呼び出し可能にするため named export
 */
export async function handleCanvasCollect({ command, ack, client }: {
  command: { text?: string; channel_id: string; user_id: string; team_id: string; team_domain: string };
  ack: () => Promise<void>;
  client: WebClient;
}): Promise<void> {
  // 1. 即座にSlackに応答（3秒制限）
  await ack();

  const channelId = command.channel_id;
  const userId = command.user_id;
  const teamId = command.team_id;
  const teamDomain = command.team_domain;

  // ユーザーのlocaleを取得
  const locale: SupportedLocale = await getUserLocale(client, userId);

  // エフェメラルメッセージ送信ヘルパー（callWithRetry でSlackエラーをAppErrorに変換）
  const sendEphemeral = async (text: string, blocks?: KnownBlock[]) => {
    await callWithRetry(() => client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text,
      ...(blocks ? { blocks } : {}),
    }));
  };

  // per-userレートリミットチェック
  if (userRateLimiter.isLimited(userId)) {
    const msg = t(locale, 'error.userRateLimited');
    await sendEphemeral(msg, buildErrorBlocks(msg));
    return;
  }
  userRateLimiter.record(userId);

  let emoji: string | undefined;

  try {
    // 2. コマンドパース → バリデーション
    const parsed = parseCommand(command.text ?? '', locale);
    emoji = parsed.emoji;

    // 3. プラン取得 → プラン制限チェック
    const plan = await getWorkspacePlan(teamId);
    checkPlanLimits(parsed, plan);

    // チャンネル名からIDを解決
    let resolvedChannelIds: string[] = [];
    if (parsed.channelNames.length > 0) {
      const { resolved, notFound } = await resolveChannelNames(client, parsed.channelNames);
      resolvedChannelIds = resolved;
      if (notFound.length > 0) {
        const channels = notFound.map(n => `#${n}`).join(', ');
        const msg = t(locale, 'error.channelNotFound', { channels });
        await sendEphemeral(msg, buildErrorBlocks(msg));
        return;
      }
    }

    // 4. 対象チャンネルを決定
    const targetChannels = new Set<string>([channelId, ...parsed.channels, ...resolvedChannelIds]);
    const channelIds = Array.from(targetChannels);

    // 5. ロック取得（「収集中」送信の前に取得して矛盾メッセージを防止）
    if (!lockManager.acquire(`${teamId}:${emoji}`)) {
      await sendEphemeral(
        t(locale, 'lock.conflictFallback', { emoji }),
        buildLockConflictBlocks(locale, emoji),
      );
      return;
    }

    try {
      // 6. 収集中メッセージ送信
      await sendEphemeral(
        t(locale, 'collecting.fallback', { channelCount: channelIds.length, emoji }),
        buildCollectingBlocks(locale, emoji, channelIds.length),
      );
      // 7. メッセージ収集
      const result = await collectMessages(client, emoji, channelIds, {
        periodDays: parsed.periodDays,
        maxMessages: PLAN_LIMITS[plan].maxMessages,
      });

      // 該当なし
      if (result.messages.length === 0) {
        await sendEphemeral(
          t(locale, 'noResult.fallback'),
          buildNoResultBlocks(locale, result.skippedChannels),
        );
        return;
      }

      // 上限超過チェック
      const limitReachedChannels = Array.from(result.channelLimitReached.entries())
        .filter(([, reached]) => reached)
        .map(([chId]) => chId);

      // 8. Canvas検索 → 作成 or 追記
      const newMarkdown = buildMarkdown(locale, emoji, result.messages, channelIds.length);
      const appendMarkdown = buildAppendMarkdown(locale, emoji, result.messages, channelIds.length);

      const { canvasUrl, isNew } = await upsertCanvas(
        client,
        channelId,
        emoji,
        newMarkdown,
        appendMarkdown,
        teamId,
        teamDomain,
        PLAN_LIMITS[plan].canAppend,
      );

      // 9. 完了通知
      await sendEphemeral(
        t(locale, 'completion.fallback', { count: result.messages.length, canvasUrl }),
        buildCompletionBlocks(locale, emoji, result.messages.length, canvasUrl, {
          limitReachedChannels: limitReachedChannels.length > 0 ? limitReachedChannels : undefined,
          skippedChannels: result.skippedChannels.length > 0 ? result.skippedChannels : undefined,
        }),
      );
    } finally {
      // 10. ロック解除（finally句で確実に）
      if (emoji) {
        lockManager.release(`${teamId}:${emoji}`);
      }
    }
  } catch (error) {
    // エラーハンドリング（sendEphemeral自体の失敗も捕捉）
    try {
      if (error instanceof AppError) {
        if (error.kind === 'NOT_IN_CHANNEL') {
          // Bot が呼び出しチャンネルに参加していないためエフェメラル送信不可
          console.warn(`handleCanvasCollect: bot not in channel ${channelId}, cannot send ephemeral`);
          return;
        }
        // messageKeyがあれば翻訳、なければそのまま（command-parserは翻訳済み）
        let msg = error.message;
        if (error.messageKey) {
          const params: Record<string, string> = { upgradeUrl: UPGRADE_URL };
          if (error.detail) params.code = error.detail;
          msg = t(locale, error.messageKey as MessageKey, params);
        }
        await sendEphemeral(msg, buildErrorBlocks(msg));
      } else {
        console.error('Unexpected error in handleCanvasCollect:', error);
        const msg = t(locale, 'error.genericFallback');
        await sendEphemeral(msg, buildErrorBlocks(msg));
      }
    } catch (sendError) {
      console.error('Failed to send error ephemeral:', sendError instanceof Error ? sendError.message : 'Unknown error');
    }
  }
}

export function registerCanvasCollectCommand(app: App): void {
  app.command('/canvas-collect', handleCanvasCollect as any);
}
