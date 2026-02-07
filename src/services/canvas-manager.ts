import type { WebClient } from '@slack/web-api';
import { CanvasInfo, AppError } from '../types';
import { callWithRetry } from './slack-api';

/**
 * Canvasタイトルを生成
 * 形式: ":emoji: 収集ログ"
 */
export function getCanvasTitle(emoji: string): string {
  return `:${emoji}: 収集ログ`;
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
      (client as any).files.list({
        types: 'canvas',
        channel: channelId,
        limit: 100,
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
): Promise<{ canvasId: string; canvasUrl: string }> {
  const title = getCanvasTitle(emoji);

  const result = await callWithRetry<any>(() =>
    (client as any).canvases.create({
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
  const canvasUrl = result.canvas_url ?? `https://slack.com/docs/${result.canvas_id}`;

  return {
    canvasId: result.canvas_id,
    canvasUrl,
  };
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
    (client as any).canvases.edit({
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
 * Canvas検索 → 追記 or 新規作成 の統合処理
 */
export async function upsertCanvas(
  client: WebClient,
  channelId: string,
  emoji: string,
  newContentMarkdown: string,
  appendContentMarkdown: string,
): Promise<{ canvasUrl: string; isNew: boolean }> {
  const existing = await findCanvas(client, channelId, emoji);

  if (existing) {
    // 既存Canvasに追記
    await appendToCanvas(client, existing.id, appendContentMarkdown);

    const canvasUrl = `https://slack.com/docs/${existing.id}`;
    return { canvasUrl, isNew: false };
  } else {
    // 新規作成
    const { canvasUrl } = await createCanvas(client, channelId, emoji, newContentMarkdown);
    return { canvasUrl, isNew: true };
  }
}
