# Stashly コードレビュー結果: Codex深層分析

**実施日:** 2026-02-12
**対象:** プロジェクト全ソースコード + 設定ファイル
**手法:** セキュリティ監査 + コード品質の2エージェント並列分析
**修正完了日:** 2026-02-16

---

## セキュリティ発見

### HIGH

- [x] **crypto.ts** — `decrypt()` でbase64デコード失敗時のエラーハンドリングが不十分。IV長(`12byte`)・AuthTag長(`16byte`)の検証がない。DB破損時に不明瞭な例外が発生する
  - **修正:** try-catch + IV/AuthTag長検証追加、エラーメッセージの明確化

- [x] **command-parser.ts (L22)** — 多言語 `PERIOD_PATTERN` でReDoS可能性。`\s+(\d+)\s+` の繰り返しがバックトラック誘発。Slackのtext長制限で実質リスク低だが、入力長制限（500文字）の追加を推奨
  - **修正:** `MAX_INPUT_LENGTH = 500` の入力長チェック追加（全7言語i18n対応）

- [x] **lock-manager.ts** — `cleanup()` が `acquire()` 時のみ実行。全絵文字で3分以上呼ばれない場合、TTL切れロックが残留。定期クリーンアップ（`setInterval` 1分）を推奨
  - **修正:** コンストラクタで60秒間隔の定期クリーンアップ、`shutdown()` メソッド追加、graceful shutdownに統合

- [x] **i18n/index.ts (L40-72)** — ローカルキャッシュ `MAX_CACHE_SIZE=1000` 到達後、`sweepExpiredLocaleCache()` で期限切れのみ削除。全エントリがTTL内だとサイズが減らない → LRU削除ロジック追加を推奨
  - **修正:** sweep後もサイズ超過の場合、最も古い `expiresAt` のエントリを削除するLRU方式追加

### MEDIUM

- [x] **slack-api.ts (L61)** — エラーレスポンスにSlack APIエラーコード（`invalid_auth` 等）がそのまま含まれる。公開情報だがi18n翻訳で汎用化が望ましい
  - **修正:** 既存の `classifyError` 内で i18n messageKey を使用済み。追加対応不要と判断

---

## コード品質発見

### P0 — Critical

- [x] **message-collector.ts (L213)** — `hasReaction()` で `r.name` の存在チェックなし。APIレスポンスが不正な場合サイレントに失敗
  - **修正:** `Array.isArray()` + `typeof r.name === 'string'` の型ガード追加

### P1 — High

- [ ] **installation-store.ts** — コネクションプール枯渇の保護なし。高負荷OAuth環境でDB操作タイムアウトの可能性。Prisma接続エラー（P1000/P1001）のリトライ追加を推奨
  - **備考:** 現時点では低トラフィックのため未対応。負荷増加時に対応予定

- [x] **lock-manager.ts (L19-28)** — `acquire()` 内がread-then-writeで非アトミック。高並行時に同一ロックを2リクエストが同時取得する理論上の可能性あり
  - **修正:** `get()` + TTLチェックを1ステップに統合したアトミック操作に変更

- [x] **message-collector.ts (L102)** — `fetchAllPages()` に最大件数制限なし。巨大ワークスペース（10,000+チャンネル）でOOMの可能性。`MAX_TOTAL_ITEMS = 10000` の上限追加を推奨
  - **修正:** `fetchAllPages()` に `MAX_TOTAL_ITEMS = 10_000` の上限追加

- [x] **slack-api.ts** — `callWithRetry()` にタイムアウトなし。APIがハングするとワーカースレッドが永久ブロック。`Promise.race` で30秒タイムアウト追加を推奨
  - **修正:** `Promise.race` で `API_TIMEOUT_MS = 30_000` のタイムアウト追加

- [x] **crypto.ts** — `getEncryptionKey()` が毎回 `process.env` から読み直し + hex検証。結果のキャッシュで効率化可能
  - **修正:** モジュールレベル `cachedKey` でキャッシュ化、`_clearKeyCache()` テスト用export追加

- [x] **installation-store.ts (L118)** — Prisma `P2025` エラー判定が `error?.code` のみ。非Prismaエラーでも `code` プロパティがあれば誤マッチ → `error?.meta` の追加チェック推奨
  - **修正:** `error?.name === 'PrismaClientKnownRequestError'` チェック追加

### P2 — Medium

- [x] **複数ファイル** — `as any` キャストが12箇所以上（Canvas API型未定義のため）。Canvas API用の型定義 `SlackWebClientExtended` を作成して削減推奨
  - **修正:** `SlackWebClientExtended` インターフェース新設、canvas-manager.ts / i18n/index.ts で `as unknown as SlackWebClientExtended` に置換
- [x] **command-parser.ts** — コマンド入力長の事前制限なし（ReDoS対策としても有効）
  - **修正:** HIGH項目と同時に対応済み
- [x] **i18n/index.ts (L109)** — `slackLocale.split('-')[0]` が空文字列になる可能性。`?? ''` のガード追加
  - **修正:** `if (!lang) return DEFAULT_LOCALE;` ガード追加
- [x] **utils/date.ts (L5)** — `parseFloat(ts) * 1000` の浮動小数点精度。`Math.round()` で丸め推奨
  - **修正:** `Math.round(parseFloat(ts) * 1000)` に変更
- [x] **block-builder.ts** — エラーブロックにエラーコード・タイムスタンプなし。デバッグ用context要素の追加推奨
  - **修正:** `buildErrorBlocks()` にISO形式タイムスタンプの context ブロック追加
- [x] **複数ファイル** — マジックナンバー（500, 200, 60000等）の定数化
  - **修正:** `FILES_LIST_LIMIT`, `MAX_INPUT_LENGTH`, `API_TIMEOUT_MS`, `MAX_TOTAL_ITEMS`, `CLEANUP_INTERVAL_MS` 等を定数化

### P3 — Low

- [x] **message-collector.ts** — 複雑な関数（`collectFromThread` 等）にJSDocコメント不足
  - **修正:** `resolveChannelNames()` に `@param` / `@returns` 付きJSDoc追加、重複JSDocブロック（旧 `getPermalink` 用）削除
- [x] **canvas-collect.ts** — per-userレートリミットの `Map<string, number>` にクリーンアップなし（微小メモリリーク）
  - **修正:** `USER_COOLDOWN_MS` 間隔の `setInterval` で期限切れエントリを定期削除

---

## 総合評価

| 観点 | スコア（修正前） | スコア（修正後） | コメント |
|------|-----------------|-----------------|---------|
| セキュリティ | 8/10 | **9.5/10** | HIGH全件修正。暗号化検証・入力制限・メモリリーク対策完了 |
| コード品質 | 7.5/10 | **9/10** | 型安全性向上、アトミック操作、タイムアウト・上限追加 |
| 本番準備度 | 70-75% | **90-95%** | P0/P1/P2全件+P3全件修正。残りはP1×1件（DB接続プール）のみ |
| テスト | 9/10 | **9.5/10** | 186テスト全パス（+11エッジケーステスト追加）。修正箇所のカバレッジ強化済み |

---

## アクションプラン

### ~~Phase 1: 即対応（1-2日）~~ ✅ 完了 (2026-02-16)
1. ~~`decrypt()` にIV/AuthTag長の検証 + try-catch追加~~
2. ~~`hasReaction()` に型ガード追加~~
3. ~~コマンド入力長の上限チェック追加~~

### ~~Phase 2: 今週中（3-5日）~~ ✅ 完了 (2026-02-16)
1. ~~ローカルキャッシュにLRU削除ロジック追加~~
2. ~~Lock Managerに定期クリーンアップ + アトミック操作化~~
3. ~~`callWithRetry()` に30秒タイムアウト追加~~
4. ~~`fetchAllPages()` に最大件数制限追加~~
5. ~~`getEncryptionKey()` の結果キャッシュ~~

### ~~Phase 3: 来週以降~~ ✅ ほぼ完了 (2026-02-16)
1. ~~Canvas API用型定義作成 → `as any` 削減~~
2. ~~マジックナンバー定数化~~
3. 構造化ログ導入（未対応）
4. ~~メモリリーク・エッジケーステスト追加~~ ✅ 完了 (2026-02-16)
5. ~~ヘルスチェックエンドポイント追加~~

### Phase 4: エッジケーステスト + JSDoc整備 ✅ 完了 (2026-02-16)
1. ~~`crypto.test.ts` — Invalid IV/AuthTag長・不正base64の復号テスト3件追加~~
2. ~~`lock-manager.test.ts` — shutdown()タイマー停止・TTL切れ再取得・_clearForTestテスト3件追加~~
3. ~~`i18n/index.test.ts` — LRU eviction満杯時・resolveLocale("-US")エッジケーステスト2件追加~~
4. ~~`slack-api.test.ts` — callWithRetryタイムアウト・fetchAllPages上限テスト2件追加~~
5. ~~`command-parser.test.ts` — 501文字超の入力長制限テスト1件追加~~
6. ~~`message-collector.ts` — 重複JSDoc削除 + resolveChannelNames() JSDoc追加~~

### 残課題
- [ ] **installation-store.ts** — Prisma接続プール枯渇保護（P1、低トラフィック時は不要）
- [ ] 構造化ログ導入
