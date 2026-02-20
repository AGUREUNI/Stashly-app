import type { Messages } from '../types';

const ja: Messages = {
  // Block Kit: 収集中
  'collecting.blocks': '🐿️ *{{channelCount}}チャンネル* から :{{emoji}}: どんぐり収集中... しばらくお待ちください',
  'collecting.fallback': '🐿️ {{channelCount}}チャンネルから :{{emoji}}: どんぐり収集中...',
  // Block Kit: 完了
  'completion.header': '収集完了',
  'completion.body': '✅ *{{count}}件* のどんぐりを収集しました\n\n📄 <{{canvasUrl}}|Canvasを確認>',
  'completion.fallback': '✅ {{count}}件のどんぐりを収集しました 📄 Canvas: {{canvasUrl}}',
  'completion.limitWarning': '⚠️ 500件以上のメッセージが見つかりました\n期間を絞って再実行してください\n例: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  'completion.skippedChannels': '⚠️ Botが未参加のためスキップ: {{channels}}',
  'completion.hint': '💡 ヒント: 重複を避けるには期間指定がおすすめ！ 例: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  // Block Kit: 該当なし
  'noResult.message': 'ℹ️ 該当するメッセージが見つかりませんでした',
  'noResult.fallback': '該当するメッセージが見つかりませんでした',
  // Block Kit: ロック競合
  'lock.conflict': '⏳ 既に:{{emoji}}: リスがどんぐりを集めています\nしばらく待ってから再度お試しください',
  'lock.conflictFallback': '⏳ 既に :{{emoji}}: どんぐり収集中です',
  // コマンドパーサーエラー
  'error.noEmoji': '絵文字を指定してください\n例: `/canvas-collect :thumbsup:`',
  'error.invalidEmoji': '`{{token}}` は有効な絵文字ではありません\n絵文字は `:emoji:` の形式で指定してください',
  'error.tooManyChannels': 'チャンネル指定は最大9個までです（実行チャンネルを含めて10個）',
  'error.multiplePeriods': '❌ 期間指定は1つまでです',
  'error.invalidPeriod': '期間は1日以上で指定してください',
  'error.periodTooLong': '期間は最大{{maxDays}}日までです',
  'error.inputTooLong': '入力が長すぎます（最大500文字）',
  'error.userRateLimited': '⏳ 連続実行の制限に達しました\nしばらく待ってから再度お試しください',
  'error.channelNotFound': '❌ チャンネル {{channels}} が見つかりません',
  // コマンド構文例
  'command.periodExample': '過去7日',
  // プランエラー
  'error.planMultiChannel': '❌ 複数チャンネルの横断収集はProプランの機能です\nProプランにアップグレードするとご利用いただけます\n👉 <{{upgradeUrl}}|Proプランを確認する>',
  'error.planPeriodTooLong': '❌ 過去30日以上の収集はProプランの機能です\nProプランにアップグレードすると全期間を対象にできます\n👉 <{{upgradeUrl}}|Proプランを確認する>',
  // APIエラー
  'error.missingScope': '❌ アプリの権限が不足しています\n管理者に再インストールを依頼してください',
  'error.authInvalid': '❌ アプリの認証が無効です\n管理者に再インストールを依頼してください',
  'error.authError': '❌ 認証エラーが発生しました\n管理者にお問い合わせください',
  'error.rateLimited': '⏳ リスが混み合っています\nしばらく待ってから再度お試しください',
  'error.channelNotFoundApi': '❌ 指定されたチャンネルが見つかりません',
  'error.canvasEditFailed': '❌ Canvasの編集権限がありません\nチャンネル管理者に権限を確認してください',
  'error.canvasCreateFailed': '❌ Canvasの作成に失敗しました\nしばらく待ってから再度お試しください',
  'error.unknown': '❌ 予期しないエラーが発生しました: {{code}}',
  'error.genericFallback': '❌ 予期しないエラーが発生しました\nしばらく待ってから再度お試しください',
  // Canvas
  'canvas.title': ':{{emoji}}: Collection Log',
  // Markdown
  'markdown.heading': ':{{emoji}}: どんぐり収集結果',
  'markdown.lastUpdated': '最終更新: {{datetime}}',
  'markdown.messageCount': '収集件数: {{count}}件',
  'markdown.targetChannels': '対象チャンネル: {{count}}',
  'markdown.viewMessage': ':link: メッセージを見る',
  'markdown.linkFailed': '(リンク取得失敗)',
};

export default ja;
