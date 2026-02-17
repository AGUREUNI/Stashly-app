import type { WebClient } from '@slack/web-api';
import { CollectedMessage, CollectionResult, ChannelInfo, AppError, SlackWebClientExtended } from '../types';
import { callWithRetry, isSkippableError } from './slack-api';
import { daysAgoToSlackTs } from '../utils/date';

/** チャンネルあたりの最大収集件数 */
const MAX_MESSAGES_PER_CHANNEL = 500;

/** テキストプレビューの最大文字数 */
const MAX_TEXT_PREVIEW_LENGTH = 80;

/** ユーザー名キャッシュ: userId → { name, expiresAt } */
const userNameCache = new Map<string, { name: string; expiresAt: number }>();

/** キャッシュTTL: 30分 */
const USER_NAME_CACHE_TTL_MS = 30 * 60 * 1000;

/** キャッシュサイズ上限 */
const MAX_USER_NAME_CACHE_SIZE = 1000;

/** テスト用: ユーザー名キャッシュをクリア */
export function _clearUserNameCacheForTest(): void {
  userNameCache.clear();
}

/**
 * ユーザーの表示名を取得する（キャッシュ付き）
 * display_name → real_name → userId の優先順でフォールバック
 */
export async function getUserDisplayName(client: WebClient, userId: string): Promise<string> {
  // キャッシュチェック
  const cached = userNameCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.name;
  }

  // サイズ上限到達時にLRU（最も古いエントリから削除）
  if (userNameCache.size >= MAX_USER_NAME_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestExpires = Infinity;
    for (const [key, value] of userNameCache) {
      if (value.expiresAt < oldestExpires) {
        oldestExpires = value.expiresAt;
        oldestKey = key;
      }
    }
    if (oldestKey) userNameCache.delete(oldestKey);
  }

  try {
    const result = await (client as unknown as SlackWebClientExtended).users.info({
      user: userId,
    });

    const profile = result.user?.profile;
    const name = profile?.display_name || profile?.real_name || result.user?.real_name || userId;

    userNameCache.set(userId, {
      name,
      expiresAt: Date.now() + USER_NAME_CACHE_TTL_MS,
    });

    return name;
  } catch {
    return userId;
  }
}

/**
 * テキストプレビューを生成（最大80文字でトランケート）
 */
function truncateText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  if (text.length <= MAX_TEXT_PREVIEW_LENGTH) return text;
  return text.slice(0, MAX_TEXT_PREVIEW_LENGTH) + '…';
}

/**
 * 指定チャンネル群から絵文字リアクション付きメッセージを収集する
 */
export async function collectMessages(
  client: WebClient,
  emoji: string,
  channelIds: string[],
  periodDays: number | null,
): Promise<CollectionResult> {
  const allMessages: CollectedMessage[] = [];
  const channelLimitReached = new Map<string, boolean>();
  const skippedChannels: ChannelInfo[] = [];

  // Bot参加チャンネルを取得
  const botChannels = await getBotChannels(client);

  for (const channelId of channelIds) {
    // Bot参加チェック
    if (!botChannels.has(channelId)) {
      const info = await getChannelInfo(client, channelId);
      if (info) {
        skippedChannels.push(info);
      }
      continue;
    }

    try {
      const { messages, limitReached } = await collectFromChannel(
        client,
        emoji,
        channelId,
        periodDays,
      );
      allMessages.push(...messages);
      channelLimitReached.set(channelId, limitReached);
    } catch (error) {
      if (isSkippableError(error)) {
        const info = await getChannelInfo(client, channelId);
        if (info) {
          skippedChannels.push(info);
        }
        continue;
      }
      throw error;
    }
  }

  // 投稿日時の古い順にソート
  allMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

  return { messages: allMessages, channelLimitReached, skippedChannels };
}

/**
 * 単一チャンネルからメッセージを収集
 */
async function collectFromChannel(
  client: WebClient,
  emoji: string,
  channelId: string,
  periodDays: number | null,
): Promise<{ messages: CollectedMessage[]; limitReached: boolean }> {
  const channelName = await getChannelName(client, channelId);
  const messages: CollectedMessage[] = [];
  let limitReached = false;

  const oldest = periodDays !== null ? daysAgoToSlackTs(periodDays) : undefined;

  // conversations.history でメッセージ取得（ページネーション）
  let cursor: string | undefined;
  let shouldContinue = true;

  while (shouldContinue) {
    const result = await callWithRetry(() =>
      client.conversations.history({
        channel: channelId,
        oldest,
        limit: 200,
        cursor,
      }),
    );

    const historyMessages = result.messages ?? [];

    for (const msg of historyMessages) {
      if (messages.length >= MAX_MESSAGES_PER_CHANNEL) {
        limitReached = true;
        shouldContinue = false;
        break;
      }

      // tsが無いメッセージはスキップ
      if (!msg.ts) continue;

      // メインメッセージの絵文字チェック
      if (hasReaction(msg, emoji)) {
        const permalink = await getPermalink(client, channelId, msg.ts);
        const userName = msg.user ? await getUserDisplayName(client, msg.user) : undefined;
        const textPreview = truncateText(msg.text);
        messages.push({
          ts: msg.ts,
          channelId,
          channelName,
          permalink,
          userName,
          textPreview,
        });
      }

      // スレッド親（reply_count > 0）のみ、スレッド返信を取得
      if (msg.reply_count && msg.reply_count > 0) {
        const threadMessages = await collectFromThread(
          client,
          emoji,
          channelId,
          channelName,
          msg.ts,
          MAX_MESSAGES_PER_CHANNEL - messages.length,
          oldest,
        );

        if (messages.length + threadMessages.messages.length > MAX_MESSAGES_PER_CHANNEL) {
          limitReached = true;
          messages.push(...threadMessages.messages.slice(0, MAX_MESSAGES_PER_CHANNEL - messages.length));
          shouldContinue = false;
          break;
        }

        messages.push(...threadMessages.messages);
      }
    }

    cursor = result.response_metadata?.next_cursor || undefined;
    if (!cursor) {
      shouldContinue = false;
    }
  }

  return { messages, limitReached };
}

/**
 * スレッド返信から絵文字リアクション付きメッセージを収集
 */
async function collectFromThread(
  client: WebClient,
  emoji: string,
  channelId: string,
  channelName: string,
  threadTs: string,
  remainingLimit: number,
  oldest?: string,
): Promise<{ messages: CollectedMessage[] }> {
  const messages: CollectedMessage[] = [];

  let cursor: string | undefined;
  let shouldContinue = true;

  while (shouldContinue) {
    const result = await callWithRetry(() =>
      client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        oldest,
        limit: 200,
        cursor,
      }),
    );

    const replyMessages = result.messages ?? [];

    for (const msg of replyMessages) {
      // tsが無いメッセージはスキップ
      if (!msg.ts) continue;

      // スレッド親自体はスキップ（メインループで処理済み）
      if (msg.ts === threadTs) continue;

      if (messages.length >= remainingLimit) {
        shouldContinue = false;
        break;
      }

      if (hasReaction(msg, emoji)) {
        const permalink = await getPermalink(client, channelId, msg.ts);
        const userName = msg.user ? await getUserDisplayName(client, msg.user) : undefined;
        const textPreview = truncateText(msg.text);
        messages.push({
          ts: msg.ts,
          channelId,
          channelName,
          permalink,
          userName,
          textPreview,
        });
      }
    }

    cursor = result.response_metadata?.next_cursor || undefined;
    if (!cursor) {
      shouldContinue = false;
    }
  }

  return { messages };
}

/**
 * メッセージに指定絵文字のリアクションがあるかチェック
 */
function hasReaction(message: any, emoji: string): boolean {
  if (!Array.isArray(message.reactions)) return false;
  return message.reactions.some((r: any) => typeof r.name === 'string' && r.name === emoji);
}

/**
 * Bot参加チャンネルIDのSetを取得
 */
async function getBotChannels(client: WebClient): Promise<Set<string>> {
  const channels = new Set<string>();
  let cursor: string | undefined;

  do {
    const result = await callWithRetry(() =>
      client.users.conversations({
        types: 'public_channel,private_channel',
        limit: 200,
        cursor,
      }),
    );

    for (const ch of result.channels ?? []) {
      if (ch.id) channels.add(ch.id);
    }

    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return channels;
}

/**
 * チャンネル名を取得
 */
async function getChannelName(client: WebClient, channelId: string): Promise<string> {
  try {
    const result = await callWithRetry(() =>
      client.conversations.info({ channel: channelId }),
    );
    return (result.channel as any)?.name ?? channelId;
  } catch {
    return channelId;
  }
}

/**
 * チャンネル情報を取得
 */
async function getChannelInfo(client: WebClient, channelId: string): Promise<ChannelInfo | null> {
  try {
    const result = await callWithRetry(() =>
      client.conversations.info({ channel: channelId }),
    );
    return {
      id: channelId,
      name: (result.channel as any)?.name ?? channelId,
    };
  } catch {
    return { id: channelId, name: channelId };
  }
}

/**
 * チャンネル名からチャンネルIDを解決する
 * conversations.list で全チャンネルの名前→IDマッピングを構築し、
 * 指定された名前リストをIDに変換する。見つからない名前は notFound に格納。
 * @param client - Slack WebClient
 * @param names - 解決対象のチャンネル名リスト
 * @returns resolved（解決済みチャンネルID配列）と notFound（未解決チャンネル名配列）
 */
export async function resolveChannelNames(
  client: WebClient,
  names: string[],
): Promise<{ resolved: string[]; notFound: string[] }> {
  if (names.length === 0) return { resolved: [], notFound: [] };

  const resolved: string[] = [];
  const notFound: string[] = [];

  // Bot参加チャンネル一覧を取得して名前→IDのマッピングを作る
  const nameToId = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const result = await callWithRetry(() =>
      client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 200,
        cursor,
      }),
    );

    for (const ch of result.channels ?? []) {
      if (ch.id && ch.name) {
        nameToId.set(ch.name, ch.id);
      }
    }

    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);

  for (const name of names) {
    const id = nameToId.get(name);
    if (id) {
      resolved.push(id);
    } else {
      notFound.push(name);
    }
  }

  return { resolved, notFound };
}

/**
 * メッセージのパーマリンクを取得
 */
async function getPermalink(client: WebClient, channelId: string, messageTs: string): Promise<string> {
  try {
    const result = await callWithRetry(() =>
      client.chat.getPermalink({
        channel: channelId,
        message_ts: messageTs,
      }),
    );
    return result.permalink ?? '';
  } catch {
    return '';
  }
}
