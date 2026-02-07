import type { WebClient } from '@slack/web-api';
import { AppError } from '../types';

/** 致命的エラーコード（リトライ不要・即終了） */
const FATAL_ERRORS = new Set([
  'missing_scope',
  'token_revoked',
  'invalid_auth',
  'not_authed',
  'account_inactive',
]);

/** スキップして続行可能なエラーコード */
const SKIPPABLE_ERRORS = new Set([
  'not_in_channel',
  'channel_not_found',
]);

/** リトライ設定 */
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Slack APIレスポンスのエラーをAppErrorに変換
 */
function classifyError(error: unknown): AppError {
  const code = (error as any)?.data?.error ?? (error as any)?.code ?? '';

  if (FATAL_ERRORS.has(code)) {
    if (code === 'missing_scope') {
      return new AppError('FATAL_API_ERROR', '❌ アプリの権限が不足しています\n管理者に再インストールを依頼してください', code);
    }
    if (code === 'token_revoked' || code === 'not_authed' || code === 'account_inactive') {
      return new AppError('FATAL_API_ERROR', '❌ アプリの認証が無効です\n管理者に再インストールを依頼してください', code);
    }
    if (code === 'invalid_auth') {
      return new AppError('FATAL_API_ERROR', '❌ 認証エラーが発生しました\n管理者にお問い合わせください', code);
    }
  }

  if (code === 'ratelimited') {
    return new AppError('RATE_LIMITED', '⏳ 処理が混み合っています\nしばらく待ってから再度お試しください', code);
  }

  if (code === 'not_in_channel') {
    return new AppError('NOT_IN_CHANNEL', '', code);
  }

  if (code === 'channel_not_found') {
    return new AppError('PARSE_ERROR', '❌ 指定されたチャンネルが見つかりません', code);
  }

  if (code === 'canvas_editing_failed') {
    return new AppError('CANVAS_EDIT_FAILED', '❌ Canvasの編集権限がありません\nチャンネル管理者に権限を確認してください', code);
  }

  if (code === 'canvas_creation_failed') {
    return new AppError('CANVAS_CREATE_FAILED', '❌ Canvasの作成に失敗しました\nしばらく待ってから再度お試しください', code);
  }

  return new AppError('UNKNOWN', `❌ 予期しないエラーが発生しました: ${code || '不明'}`, code);
}

/**
 * 指数バックオフ付きでSlack APIを呼び出す
 * ratelimited のみリトライ（最大3回）
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const code = (error as any)?.data?.error ?? (error as any)?.code ?? '';

      if (code === 'ratelimited' && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }

      throw classifyError(error);
    }
  }

  // ここに到達しないはずだが TypeScript のために
  throw new AppError('RATE_LIMITED', '⏳ 処理が混み合っています\nしばらく待ってから再度お試しください');
}

/**
 * ページネーション付きで全件取得する汎用ヘルパー
 */
export async function fetchAllPages<T>(
  fetcher: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>,
): Promise<T[]> {
  const allItems: T[] = [];
  let cursor: string | undefined;

  do {
    const result = await callWithRetry(() => fetcher(cursor));
    allItems.push(...result.items);
    cursor = result.nextCursor;
  } while (cursor);

  return allItems;
}

/**
 * エラーがスキップ可能かどうか判定
 */
export function isSkippableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.kind === 'NOT_IN_CHANNEL';
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
