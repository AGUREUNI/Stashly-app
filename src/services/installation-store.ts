import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Installation, InstallationQuery } from '@slack/oauth';
import type { InstallationStore } from '@slack/oauth';
import { encrypt, decrypt } from './crypto';
import { AppError } from '../types';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

/**
 * Installation オブジェクトから DB 保存用ペイロードを構築する共通ヘルパー
 */
function buildInstallationPayload(installation: Installation<'v2'>) {
  return {
    teamName: installation.team?.name ?? null,
    enterpriseId: installation.enterprise?.id ?? null,
    enterpriseName: installation.enterprise?.name ?? null,
    isEnterpriseInstall: installation.isEnterpriseInstall ?? false,
    botToken: encrypt(installation.bot!.token),
    botRefreshToken: installation.bot!.refreshToken ? encrypt(installation.bot!.refreshToken) : null,
    botTokenExpiresAt: installation.bot!.expiresAt
      ? new Date(installation.bot!.expiresAt * 1000)
      : null,
    botId: installation.bot!.id,
    botUserId: installation.bot!.userId,
    botScopes: installation.bot!.scopes.join(','),
    installerUserId: installation.user.id,
    installerUserToken: installation.user.token ? encrypt(installation.user.token) : null,
    installerUserScopes: installation.user.scopes?.join(',') ?? null,
    appId: installation.appId ?? null,
    tokenType: installation.tokenType ?? 'bot',
  };
}

export const installationStore: InstallationStore = {
  async storeInstallation<AuthVersion extends 'v1' | 'v2'>(
    installation: Installation<AuthVersion, boolean>,
  ): Promise<void> {
    const teamId = installation.team?.id;
    if (!teamId) {
      throw new AppError('FATAL_API_ERROR', 'Team ID is required for installation (org-wide installs are not supported)', undefined, 'error.orgWideNotSupported');
    }
    if (!installation.bot?.token) {
      throw new AppError('FATAL_API_ERROR', 'Bot token is required for installation', undefined, 'error.genericFallback');
    }

    const payload = buildInstallationPayload(installation as Installation<'v2'>);
    await prisma.slackInstallation.upsert({
      where: { teamId },
      create: { teamId, ...payload },
      update: payload,
    });
  },

  async fetchInstallation(
    query: InstallationQuery<boolean>,
  ): Promise<Installation<'v1' | 'v2', boolean>> {
    const teamId = query.teamId;
    if (!teamId) {
      throw new AppError('FATAL_API_ERROR', 'Team ID is required (org-wide installs are not supported)', undefined, 'error.orgWideNotSupported');
    }

    const record = await prisma.slackInstallation.findUnique({
      where: { teamId },
    });

    if (!record) {
      throw new AppError('FATAL_API_ERROR', `Installation not found for team: ${teamId}`, undefined, 'error.authInvalid');
    }

    return {
      team: { id: record.teamId, name: record.teamName ?? undefined },
      enterprise: record.enterpriseId
        ? { id: record.enterpriseId, name: record.enterpriseName ?? undefined }
        : undefined,
      user: {
        id: record.installerUserId,
        token: record.installerUserToken ? decrypt(record.installerUserToken) : undefined,
        scopes: record.installerUserScopes?.split(',') ?? undefined,
      },
      bot: {
        token: decrypt(record.botToken),
        refreshToken: record.botRefreshToken ? decrypt(record.botRefreshToken) : undefined,
        expiresAt: record.botTokenExpiresAt
          ? Math.floor(record.botTokenExpiresAt.getTime() / 1000)
          : undefined,
        scopes: record.botScopes.split(','),
        id: record.botId,
        userId: record.botUserId,
      },
      isEnterpriseInstall: record.isEnterpriseInstall,
      appId: record.appId ?? undefined,
      tokenType: (record.tokenType as 'bot') ?? undefined,
    } as Installation<'v1' | 'v2', boolean>;
  },

  async deleteInstallation(
    query: InstallationQuery<boolean>,
  ): Promise<void> {
    const teamId = query.teamId;
    if (!teamId) {
      throw new AppError('FATAL_API_ERROR', 'Team ID is required (org-wide installs are not supported)', undefined, 'error.orgWideNotSupported');
    }

    try {
      await prisma.slackInstallation.delete({
        where: { teamId },
      });
    } catch (error: unknown) {
      // Prisma throws P2025 when record not found - ignore silently
      if (
        typeof error === 'object' && error !== null &&
        (error as Record<string, unknown>).name === 'PrismaClientKnownRequestError' &&
        (error as Record<string, unknown>).code === 'P2025'
      ) {
        return;
      }
      throw error;
    }
  },
};
