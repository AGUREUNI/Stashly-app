/** コマンドパース結果 */
export interface ParsedCommand {
  /** 絵文字名（コロンなし） */
  emoji: string;
  /** チャンネルID配列（Slack自動変換 <#C1234|name> から取得） */
  channels: string[];
  /** プレーンテキストのチャンネル名配列（#name 形式から取得、API解決が必要） */
  channelNames: string[];
  /** 過去○日（nullは全期間） */
  periodDays: number | null;
}

/** 収集されたメッセージ */
export interface CollectedMessage {
  /** メッセージのタイムスタンプ */
  ts: string;
  /** チャンネルID */
  channelId: string;
  /** チャンネル名 */
  channelName: string;
  /** パーマリンク */
  permalink: string;
}

/** チャンネル情報 */
export interface ChannelInfo {
  id: string;
  name: string;
}

/** Canvas情報 */
export interface CanvasInfo {
  id: string;
  title: string;
  updated: number;
}

/** 収集結果 */
export interface CollectionResult {
  /** 収集メッセージ一覧 */
  messages: CollectedMessage[];
  /** チャンネルごとの上限到達フラグ */
  channelLimitReached: Map<string, boolean>;
  /** スキップされたチャンネル（Bot未参加等） */
  skippedChannels: ChannelInfo[];
}

/** エラー種別 */
export type ErrorKind =
  | 'PARSE_ERROR'
  | 'NO_EMOJI'
  | 'MULTIPLE_PERIODS'
  | 'LOCK_CONFLICT'
  | 'NOT_IN_CHANNEL'
  | 'CANVAS_CREATE_FAILED'
  | 'CANVAS_EDIT_FAILED'
  | 'RATE_LIMITED'
  | 'FATAL_API_ERROR'
  | 'UNKNOWN';

/** アプリケーションエラー */
export class AppError extends Error {
  constructor(
    public readonly kind: ErrorKind,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
