# Stashly コードレビュー & セキュリティ監査結果

**実施日:** 2026-02-12
**対象:** プロジェクト全ソースコード + 設定ファイル

---

## CRITICAL

### C-1. `coverage/` ディレクトリがgitにコミットされている

- **状態:** `.gitignore` に `coverage/` が未記載。リポジトリにソースコードのHTML形式カバレッジレポートが公開されている
- **リスク:** 内部実装詳細の漏洩
- **対策:**
  1. `.gitignore` に `coverage/` を追加
  2. `git rm -r --cached coverage/` で追跡解除
  3. コミット & プッシュ

---

## HIGH

### H-1. ロック取得タイミングが遅い（UXバグ）

- **ファイル:** `src/listeners/commands/canvas-collect.ts` (L73-86)
- **問題:** 「収集中」エフェメラル送信 → ロック取得の順になっている。同時実行時に「収集中」→「既に収集中です」と矛盾メッセージが出る
- **対策:** ロック取得を `sendEphemeral` の前に移動。ロック取得失敗時は「既に収集中」だけ返す

### H-2. catchブロック内の `sendEphemeral` 失敗でUnhandled Promise Rejection

- **ファイル:** `src/listeners/commands/canvas-collect.ts` (L134-148)
- **問題:** エラーハンドラ内のエフェメラル送信自体が失敗（トークン失効等）すると未捕捉エラーになる
- **対策:** catch内の `sendEphemeral` をさらに try-catch で囲む
  ```typescript
  } catch (error) {
    try {
      await sendEphemeral(...);
    } catch (sendError) {
      console.error('Failed to send error ephemeral:', sendError);
    }
  }
  ```

### H-3. `app.ts` のIIFEに `.catch()` がない

- **ファイル:** `src/app.ts` (L67-85)
- **問題:** 起動処理（`prisma.$connect()`, `app.start()`）失敗時にログなしでプロセスが死ぬ
- **対策:**
  ```typescript
  (async () => {
    // ...
  })().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
  ```

### H-4. `ENCRYPTION_KEY` のhexバリデーション不足

- **ファイル:** `src/services/crypto.ts` (L12-15)
- **問題:** 長さ64文字のチェックのみ。非hex文字が混入すると `Buffer.from(keyHex, 'hex')` が短い鍵を生成し、AES-256が実行時エラーになる
- **対策:**
  ```typescript
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  ```

### H-5. 起動時の環境変数バリデーションがない

- **ファイル:** `src/app.ts` (L8-55)
- **問題:** 各モードで必須の環境変数（`SLACK_SIGNING_SECRET`, `SLACK_CLIENT_SECRET`, `SLACK_STATE_SECRET`, `ENCRYPTION_KEY` 等）が未設定でもそのまま起動してしまう
- **対策:** モード判定後、必須変数をチェックして未設定ならエラーメッセージ付きで `process.exit(1)`
  - Socket Mode: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
  - OAuth Mode: `SLACK_SIGNING_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_STATE_SECRET`, `DATABASE_URL`, `ENCRYPTION_KEY`
  - HTTP Single-tenant: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`

---

## MEDIUM

### M-1. スレッド返信が期間フィルタを無視する

- **ファイル:** `src/services/message-collector.ts` — `conversations.replies` 呼び出し箇所
- **問題:** `conversations.history` には `oldest` パラメータを渡すが、`conversations.replies` には渡していない。スレッド親が期間内なら、期間外の古い返信も収集されてしまう
- **対策:** `conversations.replies` にも `oldest` パラメータを渡す。もしくは返信メッセージの `ts` を期間チェックしてフィルタ

### M-2. `periodDays` の上限バリデーションなし

- **ファイル:** `src/services/command-parser.ts` (L109-111)
- **問題:** `last 999999 days` のような指定で全チャンネル履歴取得 → API大量消費
- **対策:** 上限を設定（例: 365日）。超過時はエラーメッセージ返却

### M-3. localeキャッシュの無制限メモリ成長

- **ファイル:** `src/i18n/index.ts` (L41)
- **問題:** TTL 30分だが期限切れエントリの積極的クリーンアップなし。`LockManager` には `cleanup()` があるのに不整合
- **対策:** アクセス時に期限切れエントリをスイープするか、サイズ上限付きキャッシュに変更

### M-4. `msg.ts!` のnon-null assertionが危険

- **ファイル:** `src/services/message-collector.ts` (L102, 104, 118, 180, 182)
- **問題:** Slack APIの異常レスポンスで `ts` が `undefined` だとクラッシュ
- **対策:** `if (!msg.ts) continue;` のガードを追加して `!` を除去

### M-5. ユーザー単位のレートリミットなし

- **ファイル:** `src/listeners/commands/canvas-collect.ts`
- **問題:** 同一ユーザーが異なる絵文字で連打可能 → Bot全体のAPI消費・レート制限
- **対策:** per-user レートリミット追加（例: 1ユーザーあたり1分間にN回まで）

### M-6. `resolveChannelNames` が全チャンネル取得

- **ファイル:** `src/services/message-collector.ts` (L271-312)
- **問題:** `conversations.list` で全チャンネル一覧取得。大規模ワークスペース（数千チャンネル）で性能問題
- **対策:** `conversations.list` 結果をキャッシュするか、`conversations.info` で個別取得に変更

### M-7. `unhandledRejection` ハンドラなし

- **ファイル:** `src/app.ts`
- **問題:** 未処理のPromise Rejectionが発生してもログなしでサイレントに落ちる
- **対策:**
  ```typescript
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });
  ```

### M-8. PrismaClient がモジュールレベルでインスタンス化

- **ファイル:** `src/services/installation-store.ts` (L6)
- **問題:** 非OAuthモードでも `installation-store` がimportされるとDB接続を試みる
- **備考:** 現状は `require()` で動的読み込みしているので実害は低い。テスト時のみ注意

---

## LOW / INFO

| # | 内容 | ファイル |
|---|------|----------|
| L-1 | 暗号化キーを毎回 `process.env` から読み直している（起動時キャッシュ推奨） | `src/services/crypto.ts` |
| L-2 | Slack `Retry-After` ヘッダー無視、固定バックオフのみ | `src/services/slack-api.ts` |
| L-3 | `sourceMap: true` で本番ビルドにソースマップ含む | `tsconfig.json` |
| L-4 | ヘルスチェックエンドポイント（`/health`）なし | `src/app.ts` |
| L-5 | `_clearForTest`, `_clearLocaleCacheForTest` が本番exportされている | `lock-manager.ts`, `i18n/index.ts` |
| L-6 | ルートに `nul` ファイルが存在（Windows NULデバイスのアーティファクト） | `./nul` |
| L-7 | `parseFloat(ts)` のソートで浮動小数点精度問題 | `message-collector.ts` (L57) |
| L-8 | シャットダウン時のエラーログで `error` オブジェクト全体を出力（スタックトレース漏洩） | `src/app.ts` (L88-100) |
| L-9 | `tokenType` の unsafe cast (`as 'bot'`) | `installation-store.ts` (L102) |
| L-10 | `resolveLocale` 内の中国語チェックが到達不能コード | `i18n/index.ts` (L97-99) |
| L-11 | npm audit: 8 moderate vulnerabilities（全てprisma CLIの transitive deps、本番影響なし） | `package.json` |

---

## 対応優先順

| 優先度 | ID | 作業内容 | 想定影響範囲 |
|--------|----|----------|-------------|
| 1 | C-1 | `coverage/` をgitから除去 + `.gitignore` 追加 | `.gitignore` |
| 2 | H-1 | ロック取得タイミング修正 | `canvas-collect.ts` |
| 3 | H-2 | catch内sendEphemeralの二重try-catch | `canvas-collect.ts` |
| 4 | H-3 | IIFE `.catch()` 追加 | `app.ts` |
| 5 | H-4 | ENCRYPTION_KEY hexバリデーション | `crypto.ts` |
| 6 | H-5 | 起動時の環境変数バリデーション | `app.ts` |
| 7 | M-7 | unhandledRejection ハンドラ追加 | `app.ts` |
| 8 | M-1 | スレッド返信の期間フィルタ | `message-collector.ts` |
| 9 | M-2 | periodDays上限追加 | `command-parser.ts` |
| 10 | M-3 | localeキャッシュのクリーンアップ | `i18n/index.ts` |
| 11 | M-4 | msg.ts non-null assertion除去 | `message-collector.ts` |
| 12 | M-5 | per-userレートリミット | `canvas-collect.ts` |

---

## 良い点

- AES-256-GCM実装は正確（ランダムIV、authTag適切）
- Prisma利用でSQLインジェクションリスクなし
- `.env` はgit履歴にも一切なし
- DBトークンは暗号化保存
- Enterprise org-wide installを適切に拒否
- テスト175個、カバレッジ95%+
- `eval()`, `child_process` 等の危険なAPI未使用
- テストに本物のシークレットなし
