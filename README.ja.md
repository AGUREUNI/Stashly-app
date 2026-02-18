# 🐿️ Stashly

> リスが木の実を集めてため込むように — Stashlyは、大切なSlackメッセージを自動でCanvasに集めます。

**Stashly** は、特定の絵文字リアクションが付いたメッセージを自動収集し、Slack Canvasにチャンネル別・日付別で整理するSlackアプリです。

> 🌐 [English README](README.md)

---

## ✨ 機能

- **絵文字で収集** — 絵文字を指定するだけで、そのリアクションが付いたメッセージをまとめて収集
- **複数チャンネル対応** — 1回のコマンドで最大10チャンネルを横断検索
- **期間フィルター** — 過去N日間に絞って収集（最大365日）
- **Canvas自動整理** — チャンネル別・日付別にまとめて、絵文字ごとのCanvasに追記
- **再実行で追記** — 同じコマンドを再実行すると、既存のCanvasに新しい内容が追加される
- **7言語対応** — Slackの言語設定に合わせて自動で応答言語を切り替え

---

## 🚀 インストール

> ⚠️ Stashlyは現在 **ベータ版** です。インストールリンクは開発者にお問い合わせください。

**動作要件：**
- Slack **Proプラン以上**（Canvas機能が必要）
- 収集対象チャンネルに **ボットを招待**しておくこと（`/invite @Stashly`）

---

## 📖 使い方

### 基本 — 実行チャンネルから収集

```
/canvas-collect :emoji:
```

### チャンネルを指定

```
/canvas-collect :emoji: #channel1 #channel2
```

最大10チャンネル（実行チャンネル含む）

### 期間を絞る

```
/canvas-collect :thumbsup: 過去7日
```

### オプションを組み合わせる

```
/canvas-collect :star: #general #random 過去30日
```

---

### 期間の書き方（7言語すべて対応）

| 言語 | 例 |
|---|---|
| 日本語 | `過去7日` |
| 英語 | `last 7 days` |
| ヒンディー語 | `पिछले 7 दिन` |
| フランス語 | `derniers 7 jours` |
| スペイン語 | `últimos 7 días` |
| 中国語 | `过去7天` |
| 韓国語 | `최근 7일` |

---

## 📋 Canvas出力のサンプル

コマンドを実行したチャンネルに `:emoji: Collection Log` というタイトルのCanvasが作成（または更新）されます：

```
## :thumbsup: Collection Log
最終更新: 2026-01-15 09:00 (UTC)
収集件数: 5件
対象チャンネル: 2

### #general
**2026-01-14**
- 10:45 (UTC) [メッセージを見る](https://...)
- 11:30 (UTC) [メッセージを見る](https://...)

### #random
**2026-01-15**
- 09:15 (UTC) [メッセージを見る](https://...)
```

---

## 🌐 対応言語

Slackのプロフィール設定の言語を自動で検出して応答します。

日本語・英語・ヒンディー語・フランス語・スペイン語・中国語（簡体字）・韓国語

---

## 💬 ベータフィードバック

ベータテスト中のご意見・ご報告をお待ちしています！

- **バグ報告・機能要望：** [GitHub Issueを開く](https://github.com/AGUREUNI/Stashly-app/issues/new/choose)

バグ報告の際は以下を記載してください：
1. 実行したコマンド（例：`/canvas-collect :thumbsup: #general 過去7日`）
2. 期待していた動作
3. 実際に起きたこと（エラーメッセージがあればコピーしてください）
4. Slackのプラン（Free / Pro / Business+）

---

## 🔒 プライバシー

- 指定した絵文字リアクションが付いたメッセージのみを参照します
- **メッセージの本文は保存しません** — Canvasにはパーマリンク（リンクURL）のみを記録
- ボットトークンは暗号化して保存（AES-256-GCM）
- アンインストールは **Slack設定 → アプリの管理** からいつでも可能

---

## 🛠️ 開発者向け

<details>
<summary>ローカル開発のセットアップ</summary>

### 必要環境

- Node.js >= 20.0.0
- npm
- PostgreSQL（OAuthモード使用時）

### セットアップ

```bash
npm install
cp .env.example .env
# .env の値を設定
```

### 起動

```bash
npm run build && node dist/app.js
```

### テスト

```bash
npm test
npm run test:coverage
```

### 環境変数

| 変数名 | 必要なモード | 説明 |
|---|---|---|
| `SLACK_BOT_TOKEN` | Socket/Single-tenant | ボットトークン (xoxb-) |
| `SLACK_SIGNING_SECRET` | 全モード | 署名シークレット |
| `SLACK_APP_TOKEN` | Socketモード | アプリトークン (xapp-) |
| `SLACK_CLIENT_ID` | OAuthモード | OAuthクライアントID |
| `SLACK_CLIENT_SECRET` | OAuthモード | OAuthクライアントシークレット |
| `SLACK_STATE_SECRET` | OAuthモード | CSRF防止用ランダム文字列 |
| `DATABASE_URL` | OAuthモード | PostgreSQL接続URL |
| `ENCRYPTION_KEY` | OAuthモード | 64桁hexのAES-256-GCM暗号化キー |
| `PORT` | HTTPモード | サーバーポート（デフォルト: 3000） |

### 起動モード

| モード | 起動条件 | 用途 |
|---|---|---|
| Socketモード | `SLACK_APP_TOKEN` が設定されている | ローカル開発 |
| OAuthモード | `SLACK_CLIENT_ID` が設定されている | 本番マルチテナント |
| HTTP Single-tenant | いずれも未設定 | シンプルな単一ワークスペース |

</details>

---

## 📄 ライセンス

MIT
