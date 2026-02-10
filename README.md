# Stashly

Slack上で特定の絵文字リアクションが付いたメッセージを自動収集し、Canvasに整理してまとめるSlackアプリです。

リスが木の実を集めて蓄えるように、大切なメッセージを集めて整理します。

## 機能

### `/canvas-collect` コマンド

```
/canvas-collect :emoji: [#channel] [期間]
```

- **絵文字指定（必須）**: 収集対象の絵文字リアクションを指定
- **チャンネル指定（任意）**: 収集対象チャンネルを指定（複数可、省略時は実行チャンネル）
- **期間指定（任意）**: 収集対象の期間を指定（省略時は全期間）

#### 使用例

```
/canvas-collect :thumbsup:
/canvas-collect :star: #general #random
/canvas-collect :thumbsup: #general 過去7日
/canvas-collect :star: last 30 days
```

### 主な特徴

- 収集結果をSlack Canvasに自動整理（チャンネル別・日付別）
- 同じ絵文字で再実行すると既存Canvasに追記
- スレッド内のリアクションも収集対象
- チャンネルあたり最大500件まで収集
- 同時実行制御（同じ絵文字の並列実行を防止）
- 7言語対応（日本語, 英語, ヒンディー語, フランス語, スペイン語, 中国語, 韓国語）

## セットアップ

### 1. Slack App の作成

1. [Slack API](https://api.slack.com/apps) で新規アプリを作成
2. 以下の OAuth Scopes を追加:

| スコープ | 用途 |
|---------|------|
| `canvases:write` | Canvas作成・編集 |
| `canvases:read` | Canvas検索 |
| `files:read` | Canvas検索（files.list） |
| `channels:history` | パブリックチャンネルのメッセージ取得 |
| `groups:history` | プライベートチャンネルのメッセージ取得 |
| `channels:read` | チャンネル情報取得 |
| `groups:read` | プライベートチャンネル情報取得 |
| `commands` | スラッシュコマンド |
| `chat:write` | エフェメラルメッセージ送信 |
| `users:read` | ユーザーのlocale取得（多言語対応） |
| `reactions:read` | リアクション情報取得 |

3. Slash Command `/canvas-collect` を登録
4. ワークスペースにインストール

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成:

```bash
cp .env.example .env
```

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token    # Socket Mode 用
PORT=3000                               # HTTP Mode 用
```

### 3. Socket Mode と HTTP Mode

| モード | 用途 | 必要な設定 |
|--------|------|-----------|
| Socket Mode | ローカル開発 | `SLACK_APP_TOKEN` を設定、Slack App設定でSocket Mode有効化 |
| HTTP Mode | 本番デプロイ | `PORT` を設定、Request URLにデプロイ先URLを指定 |

`SLACK_APP_TOKEN` が設定されていればSocket Mode、なければHTTP Modeで起動します。

## 開発

### 必要環境

- Node.js >= 20.0.0
- npm

### インストール

```bash
npm install
```

### ビルド & 起動

```bash
npm run build    # TypeScript → dist/ にコンパイル
npm start        # node dist/app.js で起動
```

### テスト

```bash
npm test              # 全テスト実行（単体+統合、161テスト）
npm run test:coverage # カバレッジ付き実行
```

### ローカル開発の注意点

Socket Modeで起動したnodeプロセスはバックグラウンドに残りやすく、古いコードのまま動き続けることがあります。コード変更が反映されない場合は以下を実行してください:

```bash
# Windows
taskkill /F /IM node.exe

# macOS / Linux
pkill -f "node dist/app.js"
```

その後、ビルドし直して起動:

```bash
npm run build && node dist/app.js
```

> `npm run dev`（ts-node）はキャッシュの問題があるため、ビルド済みJSでの起動を推奨します。

## デプロイ

### Railway

1. [Railway](https://railway.app/) でプロジェクトを作成
2. GitHubリポジトリを連携（`release` ブランチをデプロイ対象に設定）
3. 環境変数を設定（`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `PORT`）
4. HTTP Modeで動作するため、RailwayのURLをSlack AppのRequest URLに設定

## 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript |
| ランタイム | Node.js (>= 20) |
| フレームワーク | @slack/bolt v4 |
| テスト | Vitest v4 + @vitest/coverage-v8 |
| ホスティング | Railway |

## プロジェクト構成

```
src/
├── app.ts                       # Bolt app初期化・起動
├── listeners/commands/
│   ├── index.ts                 # コマンドリスナー登録
│   └── canvas-collect.ts        # /canvas-collect ハンドラ
├── services/
│   ├── block-builder.ts         # Block Kit構築
│   ├── command-parser.ts        # コマンド引数パーサー
│   ├── message-collector.ts     # メッセージ収集ロジック
│   ├── canvas-manager.ts        # Canvas検索・作成・追記
│   ├── markdown-builder.ts      # Canvas用Markdown生成
│   ├── slack-api.ts             # Slack APIラッパー（リトライ付き）
│   └── lock-manager.ts          # 同時実行制御（インメモリ）
├── i18n/
│   ├── types.ts                 # i18n型定義
│   ├── index.ts                 # i18nコア
│   └── locales/                 # 言語ファイル（7言語）
├── types/
│   └── index.ts                 # 型定義
└── utils/
    └── date.ts                  # 日付ユーティリティ
```

## ライセンス

TBD
