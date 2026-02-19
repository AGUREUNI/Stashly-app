import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../types';

// vi.hoisted で mock 変数をホイスト
const { mockFindUniqueSubscription } = vi.hoisted(() => ({
  mockFindUniqueSubscription: vi.fn(),
}));

// installation-store の prisma をモック
vi.mock('./installation-store', () => ({
  prisma: {
    workspaceSubscription: {
      findUnique: mockFindUniqueSubscription,
    },
  },
}));

import { getWorkspacePlan, checkPlanLimits, PLAN_LIMITS } from './plan-manager';
import type { PlanType } from '../types';
import type { ParsedCommand } from '../types';

function createParsedCommand(overrides?: Partial<ParsedCommand>): ParsedCommand {
  return {
    emoji: 'thumbsup',
    channels: [],
    channelNames: [],
    periodDays: 7,
    ...overrides,
  };
}

describe('PLAN_LIMITS', () => {
  it('free プランは maxMessages=50, maxPeriodDays=30, canMultiChannel=false, canAppend=false', () => {
    expect(PLAN_LIMITS.free.maxMessages).toBe(50);
    expect(PLAN_LIMITS.free.maxPeriodDays).toBe(30);
    expect(PLAN_LIMITS.free.canMultiChannel).toBe(false);
    expect(PLAN_LIMITS.free.canAppend).toBe(false);
  });

  it('pro プランは maxMessages=500, maxPeriodDays=null, canMultiChannel=true, canAppend=true', () => {
    expect(PLAN_LIMITS.pro.maxMessages).toBe(500);
    expect(PLAN_LIMITS.pro.maxPeriodDays).toBeNull();
    expect(PLAN_LIMITS.pro.canMultiChannel).toBe(true);
    expect(PLAN_LIMITS.pro.canAppend).toBe(true);
  });
});

describe('getWorkspacePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('PLAN_OVERRIDE=free のとき free を返す', async () => {
    vi.stubEnv('PLAN_OVERRIDE', 'free');
    vi.stubEnv('SLACK_CLIENT_ID', 'test-client-id');
    const plan = await getWorkspacePlan('T123');
    expect(plan).toBe('free');
    expect(mockFindUniqueSubscription).not.toHaveBeenCalled();
  });

  it('PLAN_OVERRIDE=pro のとき pro を返す', async () => {
    vi.stubEnv('PLAN_OVERRIDE', 'pro');
    vi.stubEnv('SLACK_CLIENT_ID', 'test-client-id');
    const plan = await getWorkspacePlan('T123');
    expect(plan).toBe('pro');
    expect(mockFindUniqueSubscription).not.toHaveBeenCalled();
  });

  it('PLAN_OVERRIDE が無効値の場合はスキップして次の判定に進む', async () => {
    vi.stubEnv('PLAN_OVERRIDE', 'invalid');
    // SLACK_CLIENT_ID 未設定 → single-tenant → pro
    vi.stubEnv('SLACK_CLIENT_ID', '');
    const plan = await getWorkspacePlan('T123');
    expect(plan).toBe('pro');
  });

  it('SLACK_CLIENT_ID 未設定（Single-tenant）のとき pro を返す', async () => {
    vi.stubEnv('SLACK_CLIENT_ID', '');
    const plan = await getWorkspacePlan('T123');
    expect(plan).toBe('pro');
    expect(mockFindUniqueSubscription).not.toHaveBeenCalled();
  });

  it('OAuth モードでサブスクリプションが pro のとき pro を返す', async () => {
    vi.stubEnv('SLACK_CLIENT_ID', 'Ctest');
    mockFindUniqueSubscription.mockResolvedValue({ plan: 'pro' });
    const plan = await getWorkspacePlan('T123');
    expect(plan).toBe('pro');
    expect(mockFindUniqueSubscription).toHaveBeenCalledWith({ where: { teamId: 'T123' } });
  });

  it('OAuth モードでサブスクリプションが free のとき free を返す', async () => {
    vi.stubEnv('SLACK_CLIENT_ID', 'Ctest');
    mockFindUniqueSubscription.mockResolvedValue({ plan: 'free' });
    const plan = await getWorkspacePlan('T123');
    expect(plan).toBe('free');
  });

  it('OAuth モードでサブスクリプションが未存在のとき free を返す', async () => {
    vi.stubEnv('SLACK_CLIENT_ID', 'Ctest');
    mockFindUniqueSubscription.mockResolvedValue(null);
    const plan = await getWorkspacePlan('T123');
    expect(plan).toBe('free');
  });

  it('OAuth モードで不明なプラン値のとき free を返す', async () => {
    vi.stubEnv('SLACK_CLIENT_ID', 'Ctest');
    mockFindUniqueSubscription.mockResolvedValue({ plan: 'enterprise' });
    const plan = await getWorkspacePlan('T123');
    expect(plan).toBe('free');
  });
});

describe('checkPlanLimits', () => {
  // ─── Pro プラン: すべて通過 ───────────────────────────────────

  it('pro プラン: 複数チャンネル指定してもエラーにならない', () => {
    const parsed = createParsedCommand({ channels: ['C1', 'C2'], periodDays: null });
    expect(() => checkPlanLimits(parsed, 'pro')).not.toThrow();
  });

  it('pro プラン: 期間なし（全期間）でもエラーにならない', () => {
    const parsed = createParsedCommand({ periodDays: null });
    expect(() => checkPlanLimits(parsed, 'pro')).not.toThrow();
  });

  it('pro プラン: 30日以上の期間でもエラーにならない', () => {
    const parsed = createParsedCommand({ periodDays: 365 });
    expect(() => checkPlanLimits(parsed, 'pro')).not.toThrow();
  });

  // ─── Free プラン: 複数チャンネル ────────────────────────────

  it('free プラン: 追加チャンネルなし（実行チャンネルのみ）はエラーにならない', () => {
    const parsed = createParsedCommand({ channels: [], channelNames: [], periodDays: 7 });
    expect(() => checkPlanLimits(parsed, 'free')).not.toThrow();
  });

  it('free プラン: channels 指定あり → planMultiChannel エラー', () => {
    const parsed = createParsedCommand({ channels: ['C1'], periodDays: 7 });
    let thrownError: AppError | undefined;
    try {
      checkPlanLimits(parsed, 'free');
    } catch (e) {
      thrownError = e as AppError;
    }
    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError?.messageKey).toBe('error.planMultiChannel');
    expect(thrownError?.kind).toBe('PLAN_LIMIT');
  });

  it('free プラン: channelNames 指定あり → planMultiChannel エラー', () => {
    const parsed = createParsedCommand({ channelNames: ['general'], periodDays: 7 });
    expect(() => checkPlanLimits(parsed, 'free')).toThrow(AppError);
  });

  // ─── Free プラン: 期間 ───────────────────────────────────────

  it('free プラン: 30日以内の期間はエラーにならない', () => {
    const parsed = createParsedCommand({ periodDays: 30 });
    expect(() => checkPlanLimits(parsed, 'free')).not.toThrow();
  });

  it('free プラン: 1日指定はエラーにならない', () => {
    const parsed = createParsedCommand({ periodDays: 1 });
    expect(() => checkPlanLimits(parsed, 'free')).not.toThrow();
  });

  it('free プラン: 31日指定 → planPeriodTooLong エラー', () => {
    const parsed = createParsedCommand({ periodDays: 31 });
    let thrownError: AppError | undefined;
    try {
      checkPlanLimits(parsed, 'free');
    } catch (e) {
      thrownError = e as AppError;
    }
    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError?.messageKey).toBe('error.planPeriodTooLong');
    expect(thrownError?.kind).toBe('PLAN_LIMIT');
  });

  it('free プラン: 期間なし（全期間）→ planPeriodTooLong エラー', () => {
    const parsed = createParsedCommand({ periodDays: null });
    expect(() => checkPlanLimits(parsed, 'free')).toThrow(AppError);
  });

  // ─── 複数制限の組み合わせ ──────────────────────────────────

  it('free プラン: 複数チャンネル + 期間超過 → 最初のチェックで弾かれる（multiChannel）', () => {
    const parsed = createParsedCommand({ channels: ['C1'], periodDays: 365 });
    let thrownError: AppError | undefined;
    try {
      checkPlanLimits(parsed, 'free');
    } catch (e) {
      thrownError = e as AppError;
    }
    expect(thrownError?.messageKey).toBe('error.planMultiChannel');
  });
});
