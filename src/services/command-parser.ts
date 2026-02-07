import { ParsedCommand, AppError } from '../types';

/** チャンネル参照パターン（Slack自動変換）: <#C1234|channel-name> */
const LINKED_CHANNEL_PATTERN = /<#(C[A-Z0-9]+)\|[^>]*>/g;

/** プレーンテキストのチャンネル参照: #channel-name */
const PLAIN_CHANNEL_PATTERN = /#([\w-]+)/g;

/** 絵文字パターン: :emoji_name: */
const EMOJI_PATTERN = /^:([^:\s]+):$/;

/** 期間パターン: 過去○日 */
const PERIOD_PATTERN = /過去(\d+)日/g;

/**
 * /canvas-collect コマンドの引数をパースする
 *
 * 例:
 *   ":thumbsup:"
 *   ":check: <#C1234|marketing> <#C5678|sales>"
 *   ":check: #marketing #sales"
 *   ":check: 過去7日"
 */
export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new AppError('NO_EMOJI', '絵文字を指定してください\n例: `/canvas-collect :thumbsup:`');
  }

  // トークンに分割
  const tokens = trimmed.split(/\s+/);

  // 1. 絵文字を抽出（最初のトークン）
  const emojiMatch = tokens[0].match(EMOJI_PATTERN);
  if (!emojiMatch) {
    throw new AppError(
      'PARSE_ERROR',
      `\`${tokens[0]}\` は有効な絵文字ではありません\n絵文字は \`:emoji:\` の形式で指定してください`,
    );
  }
  const emoji = emojiMatch[1];

  // 2. チャンネルを抽出
  const channels: string[] = [];
  const channelNames: string[] = [];
  const remaining = tokens.slice(1).join(' ');

  // Slack自動変換形式 <#C1234|name> をチェック
  const linkedRegex = new RegExp(LINKED_CHANNEL_PATTERN.source, 'g');
  let linkedMatch;
  while ((linkedMatch = linkedRegex.exec(remaining)) !== null) {
    channels.push(linkedMatch[1]);
  }

  // 自動変換が1つもなかった場合、プレーンテキスト #name を試す
  if (channels.length === 0) {
    // 期間パターンを除外した上でプレーンチャンネルをチェック
    const withoutPeriod = remaining.replace(/過去\d+日/g, '');
    const plainRegex = new RegExp(PLAIN_CHANNEL_PATTERN.source, 'g');
    let plainMatch;
    while ((plainMatch = plainRegex.exec(withoutPeriod)) !== null) {
      channelNames.push(plainMatch[1]);
    }
  }

  // チャンネル数の上限チェック（実行チャンネル含めて最大10）
  const totalChannels = channels.length + channelNames.length;
  if (totalChannels > 9) {
    throw new AppError(
      'PARSE_ERROR',
      'チャンネル指定は最大9個までです（実行チャンネルを含めて10個）',
    );
  }

  // 3. 期間を抽出
  const periodRegex = new RegExp(PERIOD_PATTERN.source, 'g');
  const periods: number[] = [];
  let periodMatch;
  while ((periodMatch = periodRegex.exec(remaining)) !== null) {
    periods.push(parseInt(periodMatch[1], 10));
  }

  if (periods.length > 1) {
    throw new AppError('MULTIPLE_PERIODS', '❌ 期間指定は1つまでです');
  }

  const periodDays = periods.length === 1 ? periods[0] : null;

  if (periodDays !== null && periodDays <= 0) {
    throw new AppError('PARSE_ERROR', '期間は1日以上で指定してください');
  }

  return { emoji, channels, channelNames, periodDays };
}
