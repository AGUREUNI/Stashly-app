/**
 * Slackタイムスタンプ（例: "1738745400.123456"）をDateオブジェクトに変換
 */
export function slackTsToDate(ts: string): Date {
  const seconds = parseFloat(ts);
  return new Date(seconds * 1000);
}

/**
 * DateをUTC表示文字列に変換（例: "2026-02-05 06:30 (UTC)"）
 */
export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min} (UTC)`;
}

/**
 * DateをUTC日付文字列に変換（例: "2026-02-05"）
 */
export function formatDateOnlyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 現在時刻から指定日数前のSlackタイムスタンプを生成
 */
export function daysAgoToSlackTs(days: number): string {
  const now = new Date();
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return String(past.getTime() / 1000);
}
