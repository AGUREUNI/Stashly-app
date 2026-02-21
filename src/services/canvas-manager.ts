import type { WebClient } from '@slack/web-api';
import { CanvasInfo, AppError } from '../types';
import type { SlackWebClientExtended } from '../types';
import { callWithRetry } from './slack-api';

/** teamDomainのバリデーション（英小文字・数字・ハイフンのみ許可） */
function validateTeamDomain(teamDomain: string): void {
  if (!/^[a-z0-9-]+$/i.test(teamDomain)) {
    throw new AppError('INVALID_TEAM_DOMAIN', 'Invalid team domain format');
  }
}

/** files.list の1ページあたりの取得上限 */
const FILES_LIST_LIMIT = 100;

/**
 * Canvas の URL を生成する
 */
function buildCanvasUrl(teamDomain: string, teamId: string, canvasId: string): string {
  return `https://${teamDomain}.slack.com/docs/${teamId}/${canvasId}`;
}

/**
 * Canvasタイトルを生成
 * 形式: ":emoji: Collection Log"（全言語共通・英語固定）
 */
export function getCanvasTitle(emoji: string): string {
  return `:${emoji}: Collection Log`;
}

/**
 * 既存のCanvasを検索する
 * files.list (types=canvas, channel指定) → タイトル完全一致フィルタ
 * 複数存在する場合は更新日時が最新のものを返す
 */
export async function findCanvas(
  client: WebClient,
  channelId: string,
  emoji: string,
): Promise<CanvasInfo | null> {
  const title = getCanvasTitle(emoji);
  const matchingCanvases: CanvasInfo[] = [];

  let cursor: string | undefined;

  do {
    const result = await callWithRetry<any>(() =>
      (client as unknown as SlackWebClientExtended).files.list({
        types: 'canvas',
        channel: channelId,
        limit: FILES_LIST_LIMIT,
        cursor,
      }),
    );

    const files = result.files ?? [];
    for (const file of files) {
      if (file.title === title) {
        matchingCanvases.push({
          id: file.id,
          title: file.title,
          updated: file.updated ?? 0,
        });
      }
    }

    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);

  if (matchingCanvases.length === 0) {
    return null;
  }

  // 更新日時が最新のものを選択
  matchingCanvases.sort((a, b) => b.updated - a.updated);
  return matchingCanvases[0];
}

/**
 * 新しいCanvasを作成する
 */
export async function createCanvas(
  client: WebClient,
  channelId: string,
  emoji: string,
  markdownContent: string,
  teamId: string,
  teamDomain: string,
): Promise<{ canvasId: string; canvasUrl: string }> {
  validateTeamDomain(teamDomain);
  const title = getCanvasTitle(emoji);

  const result = await callWithRetry<any>(() =>
    (client as unknown as SlackWebClientExtended).canvases.create({
      title,
      channel_id: channelId,
      document_content: {
        type: 'markdown',
        markdown: markdownContent,
      },
    }),
  );

  if (!result.canvas_id) {
    throw new AppError('CANVAS_CREATE_FAILED', '❌ Canvasの作成に失敗しました\nしばらく待ってから再度お試しください');
  }

  // Canvas URLを生成
  const canvasUrl = result.canvas_url ?? buildCanvasUrl(teamDomain, teamId, result.canvas_id);

  return {
    canvasId: result.canvas_id,
    canvasUrl,
  };
}

/**
 * 既存のCanvasを削除する
 */
export async function deleteCanvas(
  client: WebClient,
  canvasId: string,
): Promise<void> {
  await callWithRetry(() =>
    (client as unknown as SlackWebClientExtended).canvases.delete({
      canvas_id: canvasId,
    }),
  );
}

/**
 * 既存のCanvasに追記する（insert_at_end オペレーション使用）
 */
export async function appendToCanvas(
  client: WebClient,
  canvasId: string,
  markdownContent: string,
): Promise<void> {
  await callWithRetry(() =>
    (client as unknown as SlackWebClientExtended).canvases.edit({
      canvas_id: canvasId,
      changes: [
        {
          operation: 'insert_at_end',
          document_content: {
            type: 'markdown',
            markdown: markdownContent,
          },
        },
      ],
    }),
  );
}

/**
 * Canvas検索 → 追記 or 上書き or 新規作成 の統合処理
 *
 * @param canAppend - true: 既存 Canvas があれば追記する（Pro プラン）
 *                   false: 既存 Canvas があれば削除して新規作成（Free プラン・上書き）
 */
export async function upsertCanvas(
  client: WebClient,
  channelId: string,
  emoji: string,
  newContentMarkdown: string,
  appendContentMarkdown: string,
  teamId: string,
  teamDomain: string,
  canAppend: boolean = true,
): Promise<{ canvasUrl: string; isNew: boolean }> {
  validateTeamDomain(teamDomain);
  const existing = await findCanvas(client, channelId, emoji);

  if (existing) {
    if (canAppend) {
      // Pro プラン: 既存 Canvas に追記
      await appendToCanvas(client, existing.id, appendContentMarkdown);
      const canvasUrl = buildCanvasUrl(teamDomain, teamId, existing.id);
      return { canvasUrl, isNew: false };
    } else {
      // Free プラン: 既存 Canvas を削除して新規作成（上書き）
      await deleteCanvas(client, existing.id);
      const { canvasUrl } = await createCanvas(client, channelId, emoji, newContentMarkdown, teamId, teamDomain);
      return { canvasUrl, isNew: true };
    }
  } else {
    // 新規作成（プランに関わらず）
    const { canvasUrl } = await createCanvas(client, channelId, emoji, newContentMarkdown, teamId, teamDomain);
    return { canvasUrl, isNew: true };
  }
}
