import type { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { parseCommand } from '../../services/command-parser';
import { collectMessages, resolveChannelNames } from '../../services/message-collector';
import { buildMarkdown, buildAppendMarkdown } from '../../services/markdown-builder';
import { upsertCanvas } from '../../services/canvas-manager';
import { lockManager } from '../../services/lock-manager';
import { AppError } from '../../types';
import { getUserLocale, t } from '../../i18n';
import type { SupportedLocale, MessageKey } from '../../i18n';
import {
  buildCollectingBlocks,
  buildCompletionBlocks,
  buildNoResultBlocks,
  buildErrorBlocks,
  buildLockConflictBlocks,
} from '../../services/block-builder';

export function registerCanvasCollectCommand(app: App): void {
  app.command('/canvas-collect', async ({ command, ack, client }) => {
    // 1. 即座にSlackに応答（3秒制限）
    await ack();

    const channelId = command.channel_id;
    const userId = command.user_id;
    const teamId = command.team_id;
    const teamDomain = command.team_domain;

    // ユーザーのlocaleを取得
    const locale: SupportedLocale = await getUserLocale(client, userId);

    // エフェメラルメッセージ送信ヘルパー
    const sendEphemeral = async (text: string, blocks?: KnownBlock[]) => {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text,
        ...(blocks ? { blocks } : {}),
      });
    };

    let emoji: string | undefined;

    try {
      // 2. コマンドパース → バリデーション
      const parsed = parseCommand(command.text ?? '', locale);
      emoji = parsed.emoji;

      // チャンネル名からIDを解決
      let resolvedChannelIds: string[] = [];
      if (parsed.channelNames.length > 0) {
        const { resolved, notFound } = await resolveChannelNames(client, parsed.channelNames);
        resolvedChannelIds = resolved;
        if (notFound.length > 0) {
          const channels = notFound.map(n => `#${n}`).join(', ');
          const msg = t(locale, 'error.channelNotFound', { channels });
          await sendEphemeral(msg, buildErrorBlocks(msg));
          return;
        }
      }

      // 3. 対象チャンネルを決定
      const targetChannels = new Set<string>([channelId, ...parsed.channels, ...resolvedChannelIds]);
      const channelIds = Array.from(targetChannels);

      // 4. 収集中メッセージ送信
      await sendEphemeral(
        t(locale, 'collecting.fallback', { channelCount: channelIds.length, emoji }),
        buildCollectingBlocks(locale, emoji, channelIds.length),
      );

      // 5. ロック取得
      if (!lockManager.acquire(emoji)) {
        await sendEphemeral(
          t(locale, 'lock.conflictFallback', { emoji }),
          buildLockConflictBlocks(locale, emoji),
        );
        return;
      }

      try {
        // 6. メッセージ収集
        const result = await collectMessages(client, emoji, channelIds, parsed.periodDays);

        // 該当なし
        if (result.messages.length === 0) {
          await sendEphemeral(
            t(locale, 'noResult.fallback'),
            buildNoResultBlocks(locale, result.skippedChannels),
          );
          return;
        }

        // 上限超過チェック
        const limitReachedChannels = Array.from(result.channelLimitReached.entries())
          .filter(([, reached]) => reached)
          .map(([chId]) => chId);

        // 7. Canvas検索 → 作成 or 追記
        const newMarkdown = buildMarkdown(locale, emoji, result.messages, channelIds.length);
        const appendMarkdown = buildAppendMarkdown(locale, emoji, result.messages, channelIds.length);

        const { canvasUrl, isNew } = await upsertCanvas(
          client,
          channelId,
          emoji,
          newMarkdown,
          appendMarkdown,
          teamId,
          teamDomain,
        );

        // 8. 完了通知
        await sendEphemeral(
          t(locale, 'completion.fallback', { count: result.messages.length, canvasUrl }),
          buildCompletionBlocks(locale, emoji, result.messages.length, canvasUrl, {
            limitReachedChannels: limitReachedChannels.length > 0 ? limitReachedChannels : undefined,
            skippedChannels: result.skippedChannels.length > 0 ? result.skippedChannels : undefined,
          }),
        );
      } finally {
        // 9. ロック解除（finally句で確実に）
        if (emoji) {
          lockManager.release(emoji);
        }
      }
    } catch (error) {
      // エラーハンドリング
      if (error instanceof AppError) {
        // messageKeyがあれば翻訳、なければそのまま（command-parserは翻訳済み）
        let msg = error.message;
        if (error.messageKey) {
          const params: Record<string, string> = {};
          if (error.detail) params.code = error.detail;
          msg = t(locale, error.messageKey as MessageKey, params);
        }
        await sendEphemeral(msg, buildErrorBlocks(msg));
      } else {
        const msg = t(locale, 'error.genericFallback');
        await sendEphemeral(msg, buildErrorBlocks(msg));
      }
    }
  });
}
