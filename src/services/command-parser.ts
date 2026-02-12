import { ParsedCommand, AppError } from '../types';
import { t } from '../i18n';
import type { SupportedLocale } from '../i18n';

/** 期間指定の上限（日） */
const MAX_PERIOD_DAYS = 365;

/** チャンネル参照パターン（Slack自動変換）: <#C1234|channel-name> */
const LINKED_CHANNEL_PATTERN = /<#(C[A-Z0-9]+)\|[^>]*>/g;

/** プレーンテキストのチャンネル参照: #channel-name */
const PLAIN_CHANNEL_PATTERN = /#([\w-]+)/g;

/** 絵文字パターン: :emoji_name: */
const EMOJI_PATTERN = /^:([^:\s]+):$/;

/**
 * 多言語対応の期間パターン（全7言語を1つの正規表現で一括マッチ）
 * ja: 過去7日 / en: last 7 days / hi: पिछले 7 दिन / fr: derniers 7 jours
 * es: últimos 7 días / zh: 过去7天 / ko: 최근 7일
 */
const PERIOD_PATTERN = /過去(\d+)日|last\s+(\d+)\s+days|पिछले\s+(\d+)\s+दिन|derniers\s+(\d+)\s+jours|últimos\s+(\d+)\s+días|过去(\d+)天|최근\s+(\d+)일/gi;

/**
 * マッチ結果から数値を抽出（どのキャプチャグループにヒットしても取得できる）
 */
function extractPeriodDays(match: RegExpExecArray): number {
  for (let i = 1; i < match.length; i++) {
    if (match[i] !== undefined) {
      return parseInt(match[i], 10);
    }
  }
  return 0;
}

/**
 * /canvas-collect コマンドの引数をパースする
 *
 * 例:
 *   ":thumbsup:"
 *   ":check: <#C1234|marketing> <#C5678|sales>"
 *   ":check: #marketing #sales"
 *   ":check: 過去7日"
 *   ":check: last 7 days"
 */
export function parseCommand(text: string, locale: SupportedLocale): ParsedCommand {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new AppError('NO_EMOJI', t(locale, 'error.noEmoji'));
  }

  // トークンに分割
  const tokens = trimmed.split(/\s+/);

  // 1. 絵文字を抽出（最初のトークン）
  const emojiMatch = tokens[0].match(EMOJI_PATTERN);
  if (!emojiMatch) {
    throw new AppError(
      'PARSE_ERROR',
      t(locale, 'error.invalidEmoji', { token: tokens[0] }),
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
    // 多言語期間パターンを除外した上でプレーンチャンネルをチェック
    const withoutPeriod = remaining.replace(PERIOD_PATTERN, '');
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
      t(locale, 'error.tooManyChannels'),
    );
  }

  // 3. 期間を抽出（多言語対応）
  const periodRegex = new RegExp(PERIOD_PATTERN.source, PERIOD_PATTERN.flags);
  const periods: number[] = [];
  let periodMatch;
  while ((periodMatch = periodRegex.exec(remaining)) !== null) {
    periods.push(extractPeriodDays(periodMatch));
  }

  if (periods.length > 1) {
    throw new AppError('MULTIPLE_PERIODS', t(locale, 'error.multiplePeriods'));
  }

  const periodDays = periods.length === 1 ? periods[0] : null;

  if (periodDays !== null && periodDays <= 0) {
    throw new AppError('PARSE_ERROR', t(locale, 'error.invalidPeriod'));
  }

  if (periodDays !== null && periodDays > MAX_PERIOD_DAYS) {
    throw new AppError('PARSE_ERROR', t(locale, 'error.periodTooLong', { maxDays: MAX_PERIOD_DAYS }));
  }

  return { emoji, channels, channelNames, periodDays };
}
