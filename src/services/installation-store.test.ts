import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Installation, InstallationQuery } from '@slack/oauth';

// vi.hoisted で mock 変数をホイスト
const { mockUpsert, mockFindUnique, mockDelete } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockFindUnique: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: class {
      slackInstallation = {
        upsert: mockUpsert,
        findUnique: mockFindUnique,
        delete: mockDelete,
      };
    },
  };
});

// crypto モック
vi.mock('./crypto', () => ({
  encrypt: (val: string) => `encrypted:${val}`,
  decrypt: (val: string) => val.replace('encrypted:', ''),
}));

import { installationStore } from './installation-store';

function createMockInstallation(overrides?: Partial<Installation<'v2', false>>): Installation<'v2', false> {
  return {
    team: { id: 'T12345', name: 'Test Team' },
    enterprise: undefined,
    user: { id: 'U12345', token: undefined, scopes: undefined },
    bot: {
      token: 'xoxb-test-token',
      scopes: ['commands', 'chat:write'],
      id: 'B12345',
      userId: 'UB12345',
    },
    isEnterpriseInstall: false,
    appId: 'A12345',
    tokenType: 'bot',
    ...overrides,
  };
}

describe('installationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeInstallation', () => {
    it('正常にインストール情報を保存する（upsert）', async () => {
      mockUpsert.mockResolvedValue({});
      const installation = createMockInstallation();

      await installationStore.storeInstallation(installation);

      expect(mockUpsert).toHaveBeenCalledOnce();
      const call = mockUpsert.mock.calls[0][0];
      expect(call.where).toEqual({ teamId: 'T12345' });
      expect(call.create.teamId).toBe('T12345');
      expect(call.create.botToken).toBe('encrypted:xoxb-test-token');
      expect(call.create.botScopes).toBe('commands,chat:write');
      expect(call.create.installerUserId).toBe('U12345');
    });

    it('teamId 未設定でエラーになる', async () => {
      const installation = createMockInstallation({
        team: undefined as any,
      });

      await expect(
        installationStore.storeInstallation(installation),
      ).rejects.toThrow('Team ID is required');
    });

    it('botToken 未設定でエラーになる', async () => {
      const installation = createMockInstallation({
        bot: undefined as any,
      });

      await expect(
        installationStore.storeInstallation(installation),
      ).rejects.toThrow('Bot token is required');
    });

    it('refreshToken やユーザートークンも暗号化して保存する', async () => {
      mockUpsert.mockResolvedValue({});
      const installation = createMockInstallation({
        bot: {
          token: 'xoxb-bot-token',
          refreshToken: 'xoxe-refresh',
          expiresAt: 1700000000,
          scopes: ['commands'],
          id: 'B12345',
          userId: 'UB12345',
        },
        user: {
          id: 'U12345',
          token: 'xoxp-user-token',
          scopes: ['identity.basic'],
        },
      });

      await installationStore.storeInstallation(installation);

      const call = mockUpsert.mock.calls[0][0];
      expect(call.create.botRefreshToken).toBe('encrypted:xoxe-refresh');
      expect(call.create.installerUserToken).toBe('encrypted:xoxp-user-token');
      expect(call.create.botTokenExpiresAt).toEqual(new Date(1700000000 * 1000));
    });
  });

  describe('fetchInstallation', () => {
    it('トークンを復号して返却する', async () => {
      mockFindUnique.mockResolvedValue({
        teamId: 'T12345',
        teamName: 'Test Team',
        enterpriseId: null,
        enterpriseName: null,
        isEnterpriseInstall: false,
        botToken: 'encrypted:xoxb-bot-token',
        botRefreshToken: null,
        botTokenExpiresAt: null,
        botId: 'B12345',
        botUserId: 'UB12345',
        botScopes: 'commands,chat:write',
        installerUserId: 'U12345',
        installerUserToken: null,
        installerUserScopes: null,
        appId: 'A12345',
        tokenType: 'bot',
      });

      const query: InstallationQuery<false> = {
        teamId: 'T12345',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      const result = await installationStore.fetchInstallation(query);

      expect(result.bot?.token).toBe('xoxb-bot-token');
      expect(result.team?.id).toBe('T12345');
      expect(result.bot?.scopes).toEqual(['commands', 'chat:write']);
    });

    it('未登録の teamId でエラーになる', async () => {
      mockFindUnique.mockResolvedValue(null);

      const query: InstallationQuery<false> = {
        teamId: 'T_UNKNOWN',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      await expect(
        installationStore.fetchInstallation(query),
      ).rejects.toThrow('Installation not found for team: T_UNKNOWN');
    });

    it('teamId なし（org-wide）でエラーになる', async () => {
      const query = {
        teamId: undefined,
        enterpriseId: 'E12345',
        isEnterpriseInstall: true,
      } as InstallationQuery<boolean>;

      await expect(
        installationStore.fetchInstallation(query),
      ).rejects.toThrow('Team ID is required');
    });
  });

  describe('deleteInstallation', () => {
    it('正常に削除する', async () => {
      mockDelete.mockResolvedValue({});

      const query: InstallationQuery<false> = {
        teamId: 'T12345',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      await installationStore.deleteInstallation!(query);
      expect(mockDelete).toHaveBeenCalledWith({ where: { teamId: 'T12345' } });
    });

    it('存在しないレコードの削除はエラーにならない', async () => {
      mockDelete.mockRejectedValue({ code: 'P2025' });

      const query: InstallationQuery<false> = {
        teamId: 'T_NONEXIST',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      // P2025 は無視される
      await expect(installationStore.deleteInstallation!(query)).resolves.toBeUndefined();
    });
  });
});
