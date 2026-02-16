# Stashly コードレビュー結果: Codex深層分析

**実施日:** 2026-02-12
**対象:** プロジェクト全ソースコード + 設定ファイル
**手法:** セキュリティ監査 + コード品質の2エージェント並列分析

---

## セキュリティ発見

### HIGH

- [ ] **crypto.ts** — `decrypt()` でbase64デコード失敗時のエラーハンドリングが不十分。IV長(`12byte`)・AuthTag長(`16byte`)の検証がない。DB破損時に不明瞭な例外が発生する
  ```typescript
  // 推奨: try-catch + 長さ検証
  const iv = Buffer.from(parts[0], 'base64');
  if (iv.length !== IV_LENGTH) throw new Error(`Invalid IV length`);
  ```

- [ ] **command-parser.ts (L22)** — 多言語 `PERIOD_PATTERN` でReDoS可能性。`\s+(\d+)\s+` の繰り返しがバックトラック誘発。Slackのtext長制限で実質リスク低だが、入力長制限（500文字）の追加を推奨

- [ ] **lock-manager.ts** — `cleanup()` が `acquire()` 時のみ実行。全絵文字で3分以上呼ばれない場合、TTL切れロックが残留。定期クリーンアップ（`setInterval` 1分）を推奨
  ```typescript
  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }
  shutdown(): void { clearInterval(this.cleanupInterval); }
  ```

- [ ] **i18n/index.ts (L40-72)** — ローカルキャッシュ `MAX_CACHE_SIZE=1000` 到達後、`sweepExpiredLocaleCache()` で期限切れのみ削除。全エントリがTTL内だとサイズが減らない → LRU削除ロジック追加を推奨

### MEDIUM

- [ ] **slack-api.ts (L61)** — エラーレスポンスにSlack APIエラーコード（`invalid_auth` 等）がそのまま含まれる。公開情報だがi18n翻訳で汎用化が望ましい

---

## コード品質発見

### P0 — Critical

- [ ] **message-collector.ts (L213)** — `hasReaction()` で `r.name` の存在チェックなし。APIレスポンスが不正な場合サイレントに失敗
  ```typescript
  // 現状
  return message.reactions.some((r: any) => r.name === emoji);
  // 推奨
  return message.reactions.some((r: any) => typeof r.name === 'string' && r.name === emoji);
  ```

### P1 — High

- [ ] **installation-store.ts** — コネクションプール枯渇の保護なし。高負荷OAuth環境でDB操作タイムアウトの可能性。Prisma接続エラー（P1000/P1001）のリトライ追加を推奨

- [ ] **lock-manager.ts (L19-28)** — `acquire()` 内がread-then-writeで非アトミック。高並行時に同一ロックを2リクエストが同時取得する理論上の可能性あり
  ```typescript
  // 推奨: 単一操作でチェック&セット
  acquire(key: string): boolean {
    const existing = this.locks.get(key);
    if (existing && Date.now() - existing.timestamp <= LOCK_TTL_MS) return false;
    this.locks.set(key, { timestamp: Date.now() });
    return true;
  }
  ```

- [ ] **message-collector.ts (L102)** — `fetchAllPages()` に最大件数制限なし。巨大ワークスペース（10,000+チャンネル）でOOMの可能性。`MAX_TOTAL_ITEMS = 10000` の上限追加を推奨

- [ ] **slack-api.ts** — `callWithRetry()` にタイムアウトなし。APIがハングするとワーカースレッドが永久ブロック。`Promise.race` で30秒タイムアウト追加を推奨

- [ ] **crypto.ts** — `getEncryptionKey()` が毎回 `process.env` から読み直し + hex検証。結果のキャッシュで効率化可能

- [ ] **installation-store.ts (L118)** — Prisma `P2025` エラー判定が `error?.code` のみ。非Prismaエラーでも `code` プロパティがあれば誤マッチ → `error?.meta` の追加チェック推奨

### P2 — Medium

- [ ] **複数ファイル** — `as any` キャストが12箇所以上（Canvas API型未定義のため）。Canvas API用の型定義 `SlackWebClientExtended` を作成して削減推奨
- [ ] **command-parser.ts** — コマンド入力長の事前制限なし（ReDoS対策としても有効）
- [ ] **i18n/index.ts (L109)** — `slackLocale.split('-')[0]` が空文字列になる可能性。`?? ''` のガード追加
- [ ] **utils/date.ts (L5)** — `parseFloat(ts) * 1000` の浮動小数点精度。`Math.round()` で丸め推奨
- [ ] **block-builder.ts** — エラーブロックにエラーコード・タイムスタンプなし。デバッグ用context要素の追加推奨
- [ ] **複数ファイル** — マジックナンバー（500, 200, 60000等）の定数化

### P3 — Low

- [ ] **message-collector.ts** — 複雑な関数（`collectFromThread` 等）にJSDocコメント不足
- [ ] **canvas-collect.ts** — per-userレートリミットの `Map<string, number>` にクリーンアップなし（微小メモリリーク）

---

## 総合評価

| 観点 | スコア | コメント |
|------|--------|---------|
| セキュリティ | **8/10** | 暗号化・OAuth・入力検証は堅牢。メモリリーク系が課題 |
| コード品質 | **7.5/10** | アーキテクチャ良好、テスト充実。型安全性とエラー伝播に改善余地 |
| 本番準備度 | **70-75%** | P0/P1修正で85%+に到達可能 |
| テスト | **9/10** | 95%カバレッジ、175テスト。エッジケース・メモリリークテストが不足 |

---

## アクションプラン

### Phase 1: 即対応（1-2日）
1. `decrypt()` にIV/AuthTag長の検証 + try-catch追加
2. `hasReaction()` に型ガード追加
3. コマンド入力長の上限チェック追加

### Phase 2: 今週中（3-5日）
1. ローカルキャッシュにLRU削除ロジック追加
2. Lock Managerに定期クリーンアップ + アトミック操作化
3. `callWithRetry()` に30秒タイムアウト追加
4. `fetchAllPages()` に最大件数制限追加
5. `getEncryptionKey()` の結果キャッシュ

### Phase 3: 来週以降
1. Canvas API用型定義作成 → `as any` 削減
2. マジックナンバー定数化
3. 構造化ログ導入
4. メモリリーク・エッジケーステスト追加
5. ヘルスチェックエンドポイント追加
