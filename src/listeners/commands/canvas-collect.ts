import type { App } from '@slack/bolt';
import { parseCommand } from '../../services/command-parser';
import { collectMessages, resolveChannelNames } from '../../services/message-collector';
import { buildMarkdown, buildAppendMarkdown } from '../../services/markdown-builder';
import { upsertCanvas } from '../../services/canvas-manager';
import { lockManager } from '../../services/lock-manager';
import { AppError } from '../../types';

export function registerCanvasCollectCommand(app: App): void {
  app.command('/canvas-collect', async ({ command, ack, client }) => {
    // 1. 即座にSlackに応答（3秒制限）
    await ack();

    const channelId = command.channel_id;
    const userId = command.user_id;

    // エフェメラルメッセージ送信ヘルパー
    const sendEphemeral = async (text: string) => {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text,
      });
    };

    // 2. 収集中メッセージ送信
    await sendEphemeral('🐿️ 収集中...');

    let emoji: string | undefined;

    try {
      // 3. コマンドパース → バリデーション
      const parsed = parseCommand(command.text ?? '');
      emoji = parsed.emoji;

      // チャンネル名からIDを解決
      let resolvedChannelIds: string[] = [];
      if (parsed.channelNames.length > 0) {
        const { resolved, notFound } = await resolveChannelNames(client, parsed.channelNames);
        resolvedChannelIds = resolved;
        if (notFound.length > 0) {
          await sendEphemeral(`❌ チャンネル ${notFound.map(n => `#${n}`).join(', ')} が見つかりません`);
          return;
        }
      }

      // 4. ロック取得
      if (!lockManager.acquire(emoji)) {
        await sendEphemeral(`⏳ 現在 :${emoji}: の収集が実行中です\nしばらく待ってから再度お試しください`);
        return;
      }

      try {
        // 5. 対象チャンネルを決定
        const targetChannels = new Set<string>([channelId, ...parsed.channels, ...resolvedChannelIds]);
        const channelIds = Array.from(targetChannels);

        // 6. メッセージ収集
        const result = await collectMessages(client, emoji, channelIds, parsed.periodDays);

        // 該当なし
        if (result.messages.length === 0) {
          let msg = 'ℹ️ 該当するメッセージが見つかりませんでした';
          if (result.skippedChannels.length > 0) {
            msg += '\n\n⚠️ 以下のチャンネルはBotが参加していないためスキップしました:';
            for (const ch of result.skippedChannels) {
              msg += `\n・#${ch.name}`;
            }
          }
          await sendEphemeral(msg);
          return;
        }

        // 上限超過チェック
        const limitReachedChannels = Array.from(result.channelLimitReached.entries())
          .filter(([, reached]) => reached)
          .map(([chId]) => chId);

        // 7. Canvas検索 → 作成 or 追記
        const newMarkdown = buildMarkdown(emoji, result.messages);
        const appendMarkdown = buildAppendMarkdown(emoji, result.messages);

        const { canvasUrl, isNew } = await upsertCanvas(
          client,
          channelId,
          emoji,
          newMarkdown,
          appendMarkdown,
        );

        // 8. 完了通知
        let completionMsg = `✅ ${result.messages.length}件のメッセージを収集しました\n📄 Canvasを確認: ${canvasUrl}`;

        // 上限超過警告
        if (limitReachedChannels.length > 0) {
          completionMsg += '\n\n⚠️ 500件以上のメッセージが見つかりました\n期間を絞って再実行してください\n例: `/canvas-collect :' + emoji + ': 過去7日`';
        }

        // スキップチャンネル通知
        if (result.skippedChannels.length > 0) {
          completionMsg += '\n\n⚠️ 以下のチャンネルはBotが参加していないためスキップしました:';
          for (const ch of result.skippedChannels) {
            completionMsg += `\n・#${ch.name}`;
          }
        }

        // ヒント
        completionMsg += '\n\n💡 ヒント: 重複を避けるには期間指定がおすすめ！\n例: `/canvas-collect :' + emoji + ': 過去7日`';

        await sendEphemeral(completionMsg);
      } finally {
        // 9. ロック解除（finally句で確実に）
        if (emoji) {
          lockManager.release(emoji);
        }
      }
    } catch (error) {
      // エラーハンドリング
      if (error instanceof AppError) {
        await sendEphemeral(error.message);
      } else {
        await sendEphemeral('❌ 予期しないエラーが発生しました\nしばらく待ってから再度お試しください');
      }
    }
  });
}
