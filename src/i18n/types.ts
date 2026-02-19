/** i18n メッセージキー定義 */
export interface Messages {
  // Block Kit: 収集中
  'collecting.blocks': string;
  'collecting.fallback': string;
  // Block Kit: 完了
  'completion.header': string;
  'completion.body': string;
  'completion.fallback': string;
  'completion.limitWarning': string;
  'completion.skippedChannels': string;
  'completion.hint': string;
  // Block Kit: 該当なし
  'noResult.message': string;
  'noResult.fallback': string;
  // Block Kit: ロック競合
  'lock.conflict': string;
  'lock.conflictFallback': string;
  // コマンドパーサーエラー
  'error.noEmoji': string;
  'error.invalidEmoji': string;
  'error.tooManyChannels': string;
  'error.multiplePeriods': string;
  'error.invalidPeriod': string;
  'error.periodTooLong': string;
  'error.inputTooLong': string;
  'error.userRateLimited': string;
  'error.channelNotFound': string;
  // コマンド構文例
  'command.periodExample': string;
  // プランエラー
  'error.planMultiChannel': string;
  'error.planPeriodTooLong': string;
  'error.planCanvasAppend': string;
  // APIエラー
  'error.missingScope': string;
  'error.authInvalid': string;
  'error.authError': string;
  'error.rateLimited': string;
  'error.channelNotFoundApi': string;
  'error.canvasEditFailed': string;
  'error.canvasCreateFailed': string;
  'error.unknown': string;
  'error.genericFallback': string;
  // Canvas
  'canvas.title': string;
  // Markdown
  'markdown.heading': string;
  'markdown.lastUpdated': string;
  'markdown.messageCount': string;
  'markdown.targetChannels': string;
  'markdown.viewMessage': string;
  'markdown.linkFailed': string;
}

export type MessageKey = keyof Messages;

export type SupportedLocale = 'ja' | 'en' | 'hi' | 'fr' | 'es' | 'zh' | 'ko';
