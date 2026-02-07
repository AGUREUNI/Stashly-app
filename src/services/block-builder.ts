import type { KnownBlock } from '@slack/types';
import { ChannelInfo } from '../types';

/**
 * 収集中メッセージのBlock Kit
 */
export function buildCollectingBlocks(emoji: string, channelCount: number): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🐿️ *${channelCount}チャンネル* から :${emoji}: を収集中... しばらくお待ちください`,
      },
    },
  ];
}

/**
 * 完了通知のBlock Kit
 */
export function buildCompletionBlocks(
  emoji: string,
  count: number,
  canvasUrl: string,
  options?: {
    limitReachedChannels?: string[];
    skippedChannels?: ChannelInfo[];
  },
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '収集完了',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✅ *${count}件* のメッセージを収集しました\n\n📄 <${canvasUrl}|Canvasを確認>`,
      },
    },
  ];

  // 上限超過警告
  if (options?.limitReachedChannels && options.limitReachedChannels.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ 500件以上のメッセージが見つかりました\n期間を絞って再実行してください\n例: \`/canvas-collect :${emoji}: 過去7日\``,
      },
    });
  }

  // スキップチャンネル
  if (options?.skippedChannels && options.skippedChannels.length > 0) {
    const chList = options.skippedChannels.map(ch => `#${ch.name}`).join(', ');
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `⚠️ Botが未参加のためスキップ: ${chList}`,
        },
      ],
    });
  }

  // ヒント
  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `💡 ヒント: 重複を避けるには期間指定がおすすめ！ 例: \`/canvas-collect :${emoji}: 過去7日\``,
        },
      ],
    },
  );

  return blocks;
}

/**
 * 該当なしメッセージのBlock Kit
 */
export function buildNoResultBlocks(skippedChannels?: ChannelInfo[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'ℹ️ 該当するメッセージが見つかりませんでした',
      },
    },
  ];

  if (skippedChannels && skippedChannels.length > 0) {
    const chList = skippedChannels.map(ch => `#${ch.name}`).join(', ');
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `⚠️ Botが未参加のためスキップ: ${chList}`,
        },
      ],
    });
  }

  return blocks;
}

/**
 * エラーメッセージのBlock Kit
 */
export function buildErrorBlocks(message: string): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: message,
      },
    },
  ];
}

/**
 * ロック競合メッセージのBlock Kit
 */
export function buildLockConflictBlocks(emoji: string): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⏳ 現在 :${emoji}: の収集が実行中です\nしばらく待ってから再度お試しください`,
      },
    },
  ];
}
