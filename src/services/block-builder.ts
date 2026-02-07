import type { KnownBlock } from '@slack/types';
import { ChannelInfo } from '../types';
import { t } from '../i18n';
import type { SupportedLocale } from '../i18n';

/**
 * 収集中メッセージのBlock Kit
 */
export function buildCollectingBlocks(locale: SupportedLocale, emoji: string, channelCount: number): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: t(locale, 'collecting.blocks', { emoji, channelCount }),
      },
    },
  ];
}

/**
 * 完了通知のBlock Kit
 */
export function buildCompletionBlocks(
  locale: SupportedLocale,
  emoji: string,
  count: number,
  canvasUrl: string,
  options?: {
    limitReachedChannels?: string[];
    skippedChannels?: ChannelInfo[];
  },
): KnownBlock[] {
  const periodExample = t(locale, 'command.periodExample');

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: t(locale, 'completion.header'),
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: t(locale, 'completion.body', { count, canvasUrl }),
      },
    },
  ];

  // 上限超過警告
  if (options?.limitReachedChannels && options.limitReachedChannels.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: t(locale, 'completion.limitWarning', { emoji, periodExample }),
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
          text: t(locale, 'completion.skippedChannels', { channels: chList }),
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
          text: t(locale, 'completion.hint', { emoji, periodExample }),
        },
      ],
    },
  );

  return blocks;
}

/**
 * 該当なしメッセージのBlock Kit
 */
export function buildNoResultBlocks(locale: SupportedLocale, skippedChannels?: ChannelInfo[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: t(locale, 'noResult.message'),
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
          text: t(locale, 'completion.skippedChannels', { channels: chList }),
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
export function buildLockConflictBlocks(locale: SupportedLocale, emoji: string): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: t(locale, 'lock.conflict', { emoji }),
      },
    },
  ];
}
