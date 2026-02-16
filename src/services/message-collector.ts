import type { WebClient } from '@slack/web-api';
import { CollectedMessage, CollectionResult, ChannelInfo, AppError } from '../types';
import { callWithRetry, isSkippableError } from './slack-api';
import { daysAgoToSlackTs } from '../utils/date';

/** チャンネルあたりの最大収集件数 */
const MAX_MESSAGES_PER_CHANNEL = 500;

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
        messages.push({
          ts: msg.ts,
          channelId,
          channelName,
          permalink,
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
        messages.push({
          ts: msg.ts,
          channelId,
          channelName,
          permalink,
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
 * メッセージのパーマリンクを取得
 */
/**
 * チャンネル名からチャンネルIDを解決する
 * Bot参加チャンネル一覧から名前でマッチング
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
