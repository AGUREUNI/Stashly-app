# Stashly (Slack Canvas Collector)

## プロジェクト概要
Slackで特定の絵文字リアクションが付いているメッセージを自動収集し、Canvasに整理してまとめるアプリ。

## ブランディング
- **アプリ名**: Stashly（リスがモチーフ、stash = 集めて隠す）
- **アイコン**: フラットデザインのリス顔 + しっぽ、ゴールデン背景

## リポジトリ & デプロイ
- **GitHub**: https://github.com/AGUREUNI/Stashly-app
- **ホスティング**: Railway（HTTP Mode）
- **ブランチ運用**:
  - `develop` - 開発ブランチ（機能開発・バグ修正）
  - `release` - 本番デプロイブランチ（Railwayと連携）
  - `main` - 安定版・ドキュメント管理

## 技術スタック
- **言語**: TypeScript
- **ランタイム**: Node.js
- **フレームワーク**: @slack/bolt v4
- **パッケージマネージャ**: npm

## プロジェクト構成
```
src/
├── app.ts                          # Bolt app初期化・起動
├── listeners/commands/
│   ├── index.ts                    # コマンドリスナー登録
│   └── canvas-collect.ts           # /canvas-collect ハンドラ
├── services/
│   ├── block-builder.ts            # Block Kit構築（エフェメラルメッセージ用）
│   ├── command-parser.ts           # コマンド引数パーサー
│   ├── message-collector.ts        # メッセージ収集ロジック
│   ├── canvas-manager.ts           # Canvas検索・作成・追記
│   ├── markdown-builder.ts         # Canvas用Markdown生成
│   ├── slack-api.ts                # Slack APIラッパー（リトライ付き）
│   └── lock-manager.ts             # 同時実行制御（インメモリ）
├── i18n/
│   ├── types.ts                    # i18n型定義（Messages, SupportedLocale）
│   ├── index.ts                    # i18nコア（t(), getUserLocale(), resolveLocale()）
│   └── locales/                    # 言語ファイル（ja, en, hi, fr, es, zh, ko）
├── types/
│   └── index.ts                    # 型定義
└── utils/
    └── date.ts                     # 日付ユーティリティ
```

## コマンド
- `npm run dev` - 開発用（ts-node）
- `npm run build` - TypeScriptビルド → dist/
- `npm start` - 本番起動（node dist/app.js）

## 環境変数
- `SLACK_BOT_TOKEN` - Bot Token (xoxb-)
- `SLACK_SIGNING_SECRET` - Signing Secret
- `SLACK_APP_TOKEN` - App Token (xapp-) ※ソケットモード用
- `PORT` - HTTPポート（デフォルト: 3000）

## ローカル開発時の注意: Socket Mode プロセス残留問題

Socket Mode で起動した node プロセスはバックグラウンドに残りやすく、古いコードのまま Slack のコマンドを処理し続ける。
コード変更が反映されない場合は、まずプロセス残留を疑うこと。

### 確実な再起動手順
```bash
# 1. 既存の node プロセスを全て終了
taskkill //F //IM node.exe

# 2. ビルドしてからコンパイル済み JS で起動（ts-node はキャッシュ問題があるため非推奨）
npm run build && node dist/app.js
```

### やってはいけないこと
- `npm run dev`（ts-node）での開発 → キャッシュで古いコードが使われる場合がある
- プロセスを止めずに再起動 → 古いインスタンスがコマンドを横取りする

## i18n（多言語対応）
- 7言語対応: ja, en, hi, fr, es, zh, ko
- 外部ライブラリ不使用、`{{variable}}` プレースホルダー方式で自作
- `t(locale, key, params?)` で翻訳、`getUserLocale(client, userId)` でlocale取得（30分キャッシュ）
- Canvas タイトルは英語固定 `:emoji: Collection Log`（検索整合性のため）
- 期間指定は全7言語でパース可能（1つの複合正規表現で一括マッチ）
- `AppError.messageKey` でi18nキーを格納、catch側で `t(locale, key)` で翻訳
- 追加スコープ: `users:read`（locale取得に必要）, `chat:write`（エフェメラル送信に必須）

## テスト
- **テストフレームワーク**: vitest v4
- **カバレッジ**: v8
- `npm test` - 全テスト実行（単体+統合、161テスト）
- `npm run test:coverage` - カバレッジ付き実行
- 単体テスト: `src/**/*.test.ts`（各サービスファイル横置き）
- 統合テスト: `src/listeners/commands/canvas-collect.integration.test.ts`
- テストヘルパー: `src/test-helpers/`（mock-client.ts, mock-command.ts）
- `handleCanvasCollect` は named export でテストから直接呼び出し可能
- 統合テストは実サービス + モックWebClient で真の統合テスト
- カバレッジ: 全体95%+、canvas-collect.ts 94%

## 起動時に読むドキュメント
- `implementation_plan.md` - 実装プラン（設計方針・ステップ・技術的判断の経緯）
- `slack_canvas_collector_spec_v1_4.md` - 詳細仕様書
