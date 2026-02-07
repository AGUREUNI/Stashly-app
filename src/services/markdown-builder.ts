import { CollectedMessage } from '../types';
import { slackTsToDate, formatDateUTC, formatDateOnlyUTC } from '../utils/date';

/**
 * 収集結果をCanvas用Markdownに変換する
 *
 * フォーマット:
 * ## :emoji: 収集結果
 * 最終更新: 2026-02-05 15:30 (UTC)
 * 収集件数: 12件
 *
 * ### #チャンネル名
 * **2026-02-04**
 * - 09:20 (UTC) [メッセージを見る](https://...)
 */
export function buildMarkdown(emoji: string, messages: CollectedMessage[]): string {
  const now = new Date();
  const lines: string[] = [];

  // ヘッダー
  lines.push(`## :${emoji}: 収集結果`);
  lines.push(`最終更新: ${formatDateUTC(now)}`);
  lines.push(`収集件数: ${messages.length}件`);
  lines.push('');

  // チャンネル別 → 日付別にグループ化
  const grouped = groupByChannelAndDate(messages);

  for (const [channelName, dateGroups] of grouped) {
    lines.push(`### #${channelName}`);

    for (const [date, msgs] of dateGroups) {
      lines.push(`**${date}**`);

      for (const msg of msgs) {
        const msgDate = slackTsToDate(msg.ts);
        const h = String(msgDate.getUTCHours()).padStart(2, '0');
        const m = String(msgDate.getUTCMinutes()).padStart(2, '0');
        const timeStr = `${h}:${m} (UTC)`;

        if (msg.permalink) {
          lines.push(`- ${timeStr} [メッセージを見る](${msg.permalink})`);
        } else {
          lines.push(`- ${timeStr} (リンク取得失敗)`);
        }
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * 追記用のMarkdownを生成（新規セクション）
 * 既存Canvasに追記する際は、区切り線の後にコンテンツを追加
 */
export function buildAppendMarkdown(emoji: string, messages: CollectedMessage[]): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('');
  lines.push(buildMarkdown(emoji, messages));

  return lines.join('\n');
}

/**
 * メッセージをチャンネル別 → 日付別にグループ化
 * 投稿日時の古い順でソート済みの入力を想定
 */
function groupByChannelAndDate(
  messages: CollectedMessage[],
): Map<string, Map<string, CollectedMessage[]>> {
  const result = new Map<string, Map<string, CollectedMessage[]>>();

  for (const msg of messages) {
    if (!result.has(msg.channelName)) {
      result.set(msg.channelName, new Map());
    }
    const dateGroups = result.get(msg.channelName)!;

    const dateKey = formatDateOnlyUTC(slackTsToDate(msg.ts));
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, []);
    }
    dateGroups.get(dateKey)!.push(msg);
  }

  return result;
}
