# リファクタリング計画

> 作成日: 2026-02-21
> 分析: Codex CLI (gpt-5.3-codex) + Claude Sonnet 4.6 によるコードレビュー

---

## 優先度まとめ

| 優先度 | 件数 | 目安工数 |
|--------|------|----------|
| 🔴 High   | 7件 | 小〜中   |
| 🟡 Medium | 6件 | 中       |
| 🟢 Low    | 3件 | 中〜大   |

---

## 🔴 High（バグリスクあり・ログ欠落など即対応推奨）

### H-1. `canvas-collect.ts:186` 非AppErrorのログが欠落

**ファイル**: `src/listeners/commands/canvas-collect.ts:185-188`

```typescript
// 現在
} else {
  const msg = t(locale, 'error.genericFallback');
  await sendEphemeral(msg, buildErrorBlocks(msg));
}
```

予期しないエラーが発生しても何のエラーか記録されない。本番でのデバッグが不可能になる。

**対処**: `console.error` でエラー内容をログする。

```typescript
} else {
  console.error('Unexpected error in handleCanvasCollect:', error);
  const msg = t(locale, 'error.genericFallback');
  await sendEphemeral(msg, buildErrorBlocks(msg));
}
```

---

### H-2. `installation-store.ts:24-62` `create`/`update` ペイロードの完全重複

**ファイル**: `src/services/installation-store.ts:24-62`

`upsert` の `create` と `update` でほぼ同一のオブジェクトが2つ存在する（`teamId` / `installerUserId` のみ差異）。片方を修正し忘れるバグの温床。

**対処**: 共通化ヘルパーを切り出す。

```typescript
function buildInstallationPayload(installation: Installation<'v2'>) {
  return {
    teamName: installation.team?.name ?? null,
    botToken: encrypt(installation.bot!.token),
    // ... 共通フィールド
  };
}

await prisma.slackInstallation.upsert({
  where: { teamId },
  create: { teamId, installerUserId: installation.user.id, ...buildInstallationPayload(installation) },
  update: buildInstallationPayload(installation),
});
```

---

### H-3. `slack-api.ts:33/87` エラーコード抽出ロジックの重複

**ファイル**: `src/services/slack-api.ts:33` と `:87`

```typescript
// classifyError 内
const code = (error as any)?.data?.error ?? (error as any)?.code ?? '';

// callWithRetry 内（同じ処理）
const code = (error as any)?.data?.error ?? (error as any)?.code ?? '';
```

同じ `(error as any)` アクセスが2箇所。`callWithRetry` が `classifyError` を呼べばよい（実際、`:96` でそう呼んでいるのに手前でも自前抽出している）。

**対処**: `callWithRetry` 内の個別抽出を削除し、`classifyError` に統一。

```typescript
// callWithRetry の catch 内
throw classifyError(error); // ratelimited 判定も classifyError に移管
```

---

### H-4. `slack-api.ts:14` `SKIPPABLE_ERRORS` セットが未使用

**ファイル**: `src/services/slack-api.ts:14-17`

```typescript
const SKIPPABLE_ERRORS = new Set([
  'not_in_channel',
  'channel_not_found',
]);
```

`isSkippableError` は `error.kind === 'NOT_IN_CHANNEL'` で判定しており、このセットは参照されていない。動作は正しいが、実装意図と実体がズレており混乱を招く。

**対処**: セットを削除。`channel_not_found` のスキップが必要なら `isSkippableError` を拡張する。

---

### H-5. `message-collector.ts` の `getBotChannels` がコレクション毎回呼ばれる

**ファイル**: `src/services/message-collector.ts:27`

```typescript
const botChannels = await getBotChannels(client);
```

`collectMessages` が呼ばれるたびに `users.conversations` の全ページネーションが走る。複数チャンネル指定時にも1回で済む。また将来的にチャンネル数が増えると遅延が顕著になる。

**対処**: `collectMessages` の引数で渡すか、呼び出し側で1度だけ取得してキャッシュする構造にする。

---

### H-6. `canvas-manager.ts:102/171` Canvas URL 生成ロジックの重複

**ファイル**: `src/services/canvas-manager.ts:102` と `:171`

```typescript
// createCanvas 内
const canvasUrl = result.canvas_url ?? `https://${teamDomain}.slack.com/docs/${teamId}/${result.canvas_id}`;

// upsertCanvas 内（append時）
const canvasUrl = `https://${teamDomain}.slack.com/docs/${teamId}/${existing.id}`;
```

URL フォーマットが変わった時に片方だけ直してバグるパターン。

**対処**: 共通関数に切り出す。

```typescript
function buildCanvasUrl(teamDomain: string, teamId: string, canvasId: string): string {
  return `https://${teamDomain}.slack.com/docs/${teamId}/${canvasId}`;
}
```

---

### H-7. `app-uninstalled.ts:5/20` `teamId` チェック + 削除処理の重複

**ファイル**: `src/listeners/events/app-uninstalled.ts:5-30`

`app_uninstalled` と `tokens_revoked` で同一の「teamIdチェック → deleteInstallation」パターンが重複。

**対処**: 共通ハンドラを切り出す。

```typescript
async function handleUninstall(teamId: string | undefined, eventName: string): Promise<void> {
  if (!teamId) {
    console.warn(`${eventName}: teamId not found in context`);
    return;
  }
  console.log(`${eventName}: removing installation for team: ${teamId}`);
  await installationStore.deleteInstallation!({ teamId, isEnterpriseInstall: false });
}
```

また `deleteInstallation` 失敗時の保護（try/catch）もここで追加する。

---

## 🟡 Medium（型安全性・エラーポリシーの統一）

### M-1. `canvas-collect.ts:48` `client: any` の除去

**ファイル**: `src/listeners/commands/canvas-collect.ts:45-49`

```typescript
export async function handleCanvasCollect({ command, ack, client }: {
  // ...
  client: any;  // ← unsafe
```

**対処**: `WebClient` 型（`@slack/web-api`）を使う。Bolt の `SlashCommandMiddlewareArgs` を使えば `:196` の `as any` キャストも同時に解消できる。

```typescript
import type { WebClient } from '@slack/web-api';
// client: WebClient に変更
```

---

### M-2. `slack-api.ts:33/87` `(error as any)` を type guard 化

**ファイル**: `src/services/slack-api.ts:33`

```typescript
const code = (error as any)?.data?.error ?? (error as any)?.code ?? '';
```

**対処**: type guard 関数に切り出す。

```typescript
function extractSlackErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return '';
  const e = error as Record<string, unknown>;
  return (
    (e.data as Record<string, unknown>)?.error as string ??
    e.code as string ??
    ''
  );
}
```

---

### M-3. `message-collector.ts:217` `hasReaction(message: any)` の型付け

**ファイル**: `src/services/message-collector.ts:217-219`

```typescript
function hasReaction(message: any, emoji: string): boolean {
```

`@slack/web-api` が提供する `MessageElement` 型（または inline type）を使えば安全にできる。

**対処**:

```typescript
function hasReaction(
  message: { reactions?: Array<{ name?: string }> },
  emoji: string,
): boolean {
```

同様に `:256` と `:272` の `result.channel as any` も `ConversationsInfoResponse` の型を利用してキャストを排除する。

---

### M-4. `installation-store.ts:120` `catch (error: any)` の修正

**ファイル**: `src/services/installation-store.ts:120`

```typescript
} catch (error: any) {
  if (error?.name === 'PrismaClientKnownRequestError' && error?.code === 'P2025') {
```

**対処**: `unknown` にして型ガードを使う。

```typescript
} catch (error: unknown) {
  if (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: string }).code === 'P2025'
  ) {
```

---

### M-5. エラークラスの不統一（`AppError` vs `Error`）

**ファイル**: `src/services/installation-store.ts:16,19,71,79,113` / `src/services/crypto.ts:15,18,51,61,64,76`

`installation-store.ts` と `crypto.ts` は素の `Error` を投げており、`plan-manager.ts` は `AppError` を投げている。上位層でのエラーハンドリングが複雑化する。

**方針の整理**:

| 層 | 使うべき型 | 理由 |
|----|-----------|------|
| `crypto.ts`（インフラ） | `Error` のまま OK | 起動時検証エラーであり上位に伝播させない |
| `installation-store.ts`（DB I/O） | 現状 `Error` → `AppError` に統一推奨 | `handleCanvasCollect` の catch で `AppError` を想定しているため |

**対処**: `installation-store.ts` の `throw new Error(...)` を対応する `AppError` に差し替え、`messageKey` を付与する。

---

### M-6. `block-builder.ts:73/117` `skippedChannels` ブロック生成の重複

**ファイル**: `src/services/block-builder.ts:66-77` と `:110-121`

`buildCompletionBlocks` と `buildNoResultBlocks` で「スキップチャンネルを context block に変換する」処理が重複。

**対処**: プライベートヘルパーに切り出す。

```typescript
function buildSkippedChannelsBlock(locale: SupportedLocale, skippedChannels: ChannelInfo[]): KnownBlock {
  const chList = skippedChannels.map(ch => `#${ch.name}`).join(', ');
  return {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: t(locale, 'completion.skippedChannels', { channels: chList }) }],
  };
}
```

---

## 🟢 Low（構造的改善・DI・テスタビリティ向上）

### L-1. `canvas-collect.ts:27` モジュールトップレベルの `setInterval` をクラス化

**ファイル**: `src/listeners/commands/canvas-collect.ts:21-34`

`userLastExecution` マップと `setInterval` がモジュールトップレベルにあり、グローバル副作用になっている。`lockManager` と同様にクラスにすれば一貫性が上がる。

**対処**: `UserRateLimiter` クラスを作成し、`lockManager` と同じパターンにする。

---

### L-2. `message-collector.ts:251/265` `getChannelName` / `getChannelInfo` の統合

**ファイル**: `src/services/message-collector.ts:251-276`

両関数が `conversations.info` を呼ぶ重複実装。返す型だけが異なる（`string` vs `ChannelInfo | null`）。

**対処**: `getChannelName` が `getChannelInfo` を呼ぶ形に統合する。

```typescript
async function getChannelInfo(client: WebClient, channelId: string): Promise<ChannelInfo> {
  try {
    const result = await callWithRetry(() => client.conversations.info({ channel: channelId }));
    const name = (result.channel as { name?: string })?.name ?? channelId;
    return { id: channelId, name };
  } catch {
    return { id: channelId, name: channelId };
  }
}

async function getChannelName(client: WebClient, channelId: string): Promise<string> {
  return (await getChannelInfo(client, channelId)).name;
}
```

---

### L-3. `process.env` / `prisma` の直参照を DI 化

**ファイル**: `src/services/plan-manager.ts:28,31,33` / `src/services/installation-store.ts:7-8`

`getWorkspacePlan` が `process.env.PLAN_OVERRIDE` や `process.env.SLACK_CLIENT_ID` を直参照しており、単体テスト時に `vi.stubEnv` が必要。`prisma` もモジュールトップレベルで即時生成されている。

**対処**: 関数引数もしくはファクトリ関数経由で差し替え可能にする（大規模変更なので段階的に）。

---

## テスト追加が必要なファイル

以下のファイルに対応するユニットテストが存在しない。

| ファイル | 追加すべきテスト |
|----------|----------------|
| `src/app.ts` | `validateEnvVars` のロジック、`createApp` のモード分岐 |
| `src/listeners/events/app-uninstalled.ts` | `app_uninstalled` / `tokens_revoked` イベントハンドラ |

---

## 対応順序（推奨）

```
H-1 → H-3 → H-4  （1〜2時間: ログ追加・重複削除・セット整理）
H-2 → H-6 → H-7  （2〜3時間: 重複コード共通化）
H-5              （1時間: getBotChannels の呼び出し最適化）
M-1 → M-2 → M-3 → M-4  （2〜3時間: 型安全性）
M-5 → M-6       （1〜2時間: エラーポリシー・block重複）
L-1 → L-2       （2時間: 構造整理）
L-3              （大きめ: 段階的に対応）
テスト追加       （最後に）
```

---

## 変更後に必ず実行すること

```bash
npm run build        # TypeScript コンパイル確認
npm test             # 全215テストがパスすること
npm run test:coverage # カバレッジ 95%+ を維持すること
```
