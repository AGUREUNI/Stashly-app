import { prisma } from './installation-store';
import { AppError, ParsedCommand, PlanType } from '../types';

export type { PlanType };

/** プランごとの制限設定 */
export const PLAN_LIMITS = {
  free: { maxMessages: 50,  maxPeriodDays: 30   as number | null, canMultiChannel: false, canAppend: false },
  pro:  { maxMessages: 500, maxPeriodDays: null  as number | null, canMultiChannel: true,  canAppend: true  },
} as const;

/**
 * ワークスペースのプランを取得する
 *
 * 優先順位:
 * 1. PLAN_OVERRIDE 環境変数（free/pro）→ デバッグ・Single-tenant 検証用
 * 2. SLACK_CLIENT_ID 未設定（Single-tenant）→ 'pro' 固定
 * 3. WorkspaceSubscription テーブルから取得（OAuth モード）
 * 4. レコード未存在なら 'free'
 */
export async function getWorkspacePlan(teamId: string): Promise<PlanType> {
  const override = process.env.PLAN_OVERRIDE;
  if (override === 'free' || override === 'pro') return override;

  if (!process.env.SLACK_CLIENT_ID) return 'pro'; // Single-tenant は pro 固定

  const sub = await prisma.workspaceSubscription.findUnique({ where: { teamId } });
  const plan = sub?.plan ?? 'free';
  return (plan === 'pro' ? 'pro' : 'free') as PlanType;
}

/**
 * プラン制限チェック
 * 違反時は AppError (kind='PLAN_LIMIT') を投げる
 *
 * チェック内容:
 * - canMultiChannel: false かつ追加チャンネル指定あり → error.planMultiChannel
 * - maxPeriodDays: 指定期間 > 上限 または 無指定（全期間）→ error.planPeriodTooLong
 *
 * ※ メッセージ上限は collectMessages 内で処理
 * ※ Canvas 追記制限は upsertCanvas 内で処理
 */
export function checkPlanLimits(parsed: ParsedCommand, plan: PlanType): void {
  const limits = PLAN_LIMITS[plan];

  // 複数チャンネルチェック
  if (!limits.canMultiChannel && (parsed.channels.length > 0 || parsed.channelNames.length > 0)) {
    throw new AppError('PLAN_LIMIT', 'Multi-channel collection is not available in Free plan', undefined, 'error.planMultiChannel');
  }

  // 期間チェック: Free プランは periodDays を必須とし、30日以内に制限
  if (limits.maxPeriodDays !== null) {
    if (parsed.periodDays === null || parsed.periodDays > limits.maxPeriodDays) {
      throw new AppError('PLAN_LIMIT', 'Period too long for Free plan', undefined, 'error.planPeriodTooLong');
    }
  }
}
