# Slack Canvas Collector - 実装プラン

## Context

仕様書 `slack_canvas_collector_spec_v1_4.md` に基づいて、Slack Canvas Collector アプリをゼロから構築する。フェーズ2（プロトタイプ開発）として、まずMVPを実装し、その後フェーズ3の機能拡張へ進む。

**仕様書からの発見・修正点:**
- `canvases.edit` の `insert_at_end` オペレーションが使えるため、`canvases.sections.lookup` は不要
- 仕様書に `chat:write` スコープが抜けている（エフェメラルメッセージ送信に必須）

## 技術スタック

| 項目 | 選定 |
|------|------|
| 言語 | TypeScript |
| ランタイム | Node.js |
| フレームワーク | @slack/bolt |
| ホスティング | Railway |
| ロック機構 | インメモリ Map + TTL（MVP） |
| パッケージマネージャ | npm |

## プロジェクト構成

```
CanvasApp/
├── src/
│   ├── app.ts                          # Bolt app初期化・起動
│   ├── listeners/
│   │   └── commands/
│   │       ├── index.ts                # コマンドリスナー登録
│   │       └── canvas-collect.ts       # /canvas-collect ハンドラ
│   ├── services/
│   │   ├── command-parser.ts           # コマンド引数パーサー
│   │   ├── message-collector.ts        # メッセージ収集ロジック
│   │   ├── canvas-manager.ts           # Canvas検索・作成・追記
│   │   ├── markdown-builder.ts         # Canvas用Markdown生成
│   │   ├── slack-api.ts                # Slack APIラッパー（リトライ付き）
│   │   └── lock-manager.ts            # 同時実行制御（インメモリ）
│   ├── types/
│   │   └── index.ts                    # 型定義
│   └── utils/
│       └── date.ts                     # 日付ユーティリティ（UTC変換等）
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md                          # セットアップ手順（最小限）
```

## 実装ステップ

### Step 1: プロジェクト初期化 ✅ 完了
- `package.json` 作成（`@slack/bolt`, `dotenv`, TypeScript関連）
- `tsconfig.json` 作成
- `.env.example` 作成（`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`, `PORT`）
- `.gitignore` 作成

### Step 2: アプリ基盤 ✅ 完了
- `src/app.ts` - Bolt app初期化、ソケットモードまたはHTTPモードで起動
- `src/listeners/commands/index.ts` - コマンド登録
- `src/types/index.ts` - 共通型定義

### Step 3: コマンドパーサー ✅ 完了
**ファイル**: `src/services/command-parser.ts`

```typescript
interface ParsedCommand {
  emoji: string;           // 絵文字名（コロンなし）
  channels: string[];      // チャンネルID配列（Slack自動変換形式）
  channelNames: string[];  // プレーンテキストのチャンネル名（API解決が必要）
  periodDays: number | null; // 過去○日（nullは全期間）
}
```

- Slackが自動変換する `<#C1234|channel-name>` 形式をパース
- **`#channel-name` プレーンテキスト形式もパース**（Slack未変換ケース対応）
- `:emoji:` 形式から絵文字名を抽出
- `過去○日` パターンを正規表現で検出
- バリデーション: 複数期間指定はエラー

### Step 4: Slack APIラッパー ✅ 完了
**ファイル**: `src/services/slack-api.ts`

- 全Slack API呼び出しをラップ
- `ratelimited` エラーのみリトライ（指数バックオフ: 1s → 2s → 4s、最大3回）
- エラー分類: 続行可能（`not_in_channel`）vs 致命的（`missing_scope`, `token_revoked` 等）
- ページネーション対応のヘルパー

### Step 5: メッセージ収集 ✅ 完了
**ファイル**: `src/services/message-collector.ts`

処理フロー:
1. `conversations.history` でメッセージ取得（ページネーション対応）
2. 各メッセージの `reactions` 配列をチェック → 対象絵文字でフィルタ
3. チャンネルごとに500件上限チェック
4. スレッド親（`reply_count > 0`）のみ `conversations.replies` 呼び出し
5. スレッド返信の中から対象絵文字があるものを追加
6. 全メッセージを投稿日時の古い順にソート
7. **`resolveChannelNames()` でプレーンテキストのチャンネル名→ID解決**

```typescript
interface CollectedMessage {
  ts: string;
  channelId: string;
  channelName: string;
  permalink: string;        // chat.getPermalink で取得
}
```

### Step 6: Markdown生成 ✅ 完了
**ファイル**: `src/services/markdown-builder.ts`

- 収集結果を仕様書のフォーマットに変換
- チャンネル別 → 日付別にグループ化
- UTC固定表示（`2026-02-05 06:30 (UTC)` 形式）
- メッセージリンク生成
- **日付グループは `**太字**` 使用**（Canvas APIがh4非対応のため）

### Step 7: Canvas管理 ✅ 完了
**ファイル**: `src/services/canvas-manager.ts`

- **検索**: `files.list` (types=canvas, channel指定) → タイトル完全一致フィルタ
- **作成**: `canvases.create` (title, channel_id, document_content)
- **追記**: `canvases.edit` (`insert_at_end` オペレーション使用)
- 複数Canvas存在時は `updated` が最新のものに追記

### Step 8: 同時実行制御 ✅ 完了
**ファイル**: `src/services/lock-manager.ts`

```typescript
class LockManager {
  private locks: Map<string, { timestamp: number }>;
  acquire(emoji: string): boolean;  // ロック取得（3分TTL）
  release(emoji: string): void;     // ロック解除
}
```

### Step 9: メインハンドラ統合 ✅ 完了
**ファイル**: `src/listeners/commands/canvas-collect.ts`

全体フロー:
1. `ack()` で即座にSlackに応答（3秒制限）
2. エフェメラルメッセージ送信（🐿️ 収集中...）
3. コマンドパース → バリデーション
4. **チャンネル名→ID解決**（プレーンテキスト `#name` 形式対応）
5. ロック取得 → 失敗時はエラーメッセージ
6. Botが参加しているチャンネルを確認（`users.conversations`）
7. メッセージ収集
8. Canvas検索 → 作成 or 追記
9. 完了通知（件数 + Canvasリンク + ヒント）
10. ロック解除（finally句で確実に）

### Step 10: エラーハンドリング統合 ✅ 完了
- 仕様書の全エラーパターンに対応するメッセージ定数を定義
- try-catch + finally でロック解除を保証
- エフェメラルメッセージでユーザーにエラー通知

## 環境変数

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...    # ソケットモード用
PORT=3000                    # HTTPモード用
```

## Slack App設定（手動）

1. https://api.slack.com/apps で新規アプリ作成
2. OAuth Scopes追加:
   - `canvases:write`, `canvases:read`, `files:read`
   - `channels:history`, `groups:history`
   - `channels:read`, `groups:read`
   - `commands`
   - **`chat:write`**（仕様書に抜けているが必須）
3. Slash Command `/canvas-collect` を登録
4. ソケットモード有効化（開発時）またはRequest URL設定（本番時）
5. ワークスペースにインストール

## ローカル開発

- ソケットモードを使用（ngrok不要）
- `npm run dev` で `ts-node` + `nodemon` で起動
- `.env` ファイルにトークン設定

## Railway デプロイ

- `npm run build` → `dist/` にコンパイル
- `npm start` → `node dist/app.js` で起動
- Railway環境変数にSlackトークン設定
- HTTPモードで動作（Request URLをRailwayのURLに設定）

## 検証方法

1. **ローカル動作確認**: ソケットモードでBoltアプリ起動 → テストチャンネルで `/canvas-collect :thumbsup:` 実行 ✅ 確認済み
2. **Canvas作成確認**: チャンネルタブにCanvasが追加されるか確認 ✅ 確認済み
3. **追記確認**: 同じ絵文字で再実行 → 既存Canvasに追記されるか確認 ✅ 確認済み
4. **複数チャンネル確認**: `#channel` 指定で他チャンネルからも収集されるか確認 ✅ 確認済み
5. **エラー確認**: 存在しない絵文字、権限不足等でエラーメッセージが表示されるか
6. **同時実行確認**: 同じ絵文字で同時に2回実行 → ロックエラーが出るか
7. **500件上限確認**: 大量メッセージがあるチャンネルで上限警告が出るか

## 実装優先順位

MVP（最初にやること）:
1. プロジェクト初期化 + アプリ基盤（Step 1-2）
2. コマンドパーサー（Step 3）
3. Slack APIラッパー（Step 4）
4. メッセージ収集（Step 5）
5. Markdown生成（Step 6）
6. Canvas管理（Step 7）
7. 同時実行制御（Step 8）
8. メインハンドラ統合（Step 9）
9. エラーハンドリング（Step 10）

全Step完了で、仕様書のフェーズ2+3の機能が揃う。

## 実装中の発見・修正事項

### Canvas API: h4非対応
- `####`（h4）を使うと `Unsupported heading depth (4)` エラー
- Canvas APIのMarkdownはh1〜h3のみ対応
- **対応**: 日付グループの見出しを `####` → `**太字**` に変更

### Slackコマンドのチャンネル自動変換
- スラッシュコマンドで `#channel` と入力しても、Slackが `<#C1234|name>` 形式に自動変換しないケースがある
- **対応**: `#channel-name` プレーンテキスト形式もパースし、`conversations.list` でチャンネル名→ID解決を行うように修正

### Socket Mode プロセス残留
- バックグラウンドで起動した node プロセスが終了されず残留しやすい
- 古いプロセスがSlackのコマンドを横取りするため、コード変更が反映されない
- **対応**: 再起動時は `taskkill //F //IM node.exe` で全プロセスを終了してから起動
- **対応**: `npm run dev`（ts-node）はキャッシュ問題があるため、`npm run build && node dist/app.js` を使用
