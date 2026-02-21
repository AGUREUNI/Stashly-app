import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDeleteInstallation } = vi.hoisted(() => {
  return { mockDeleteInstallation: vi.fn().mockResolvedValue(undefined) };
});

vi.mock('../../services/installation-store', () => ({
  installationStore: {
    deleteInstallation: mockDeleteInstallation,
  },
}));

import { registerAppUninstalledEvent } from './app-uninstalled';
import type { App } from '@slack/bolt';

/** Bolt App のイベント登録をキャプチャする最小モック */
function createMockApp() {
  const handlers = new Map<string, (args: any) => Promise<void>>();
  const app = {
    event: (eventName: string, handler: (args: any) => Promise<void>) => {
      handlers.set(eventName, handler);
    },
    getHandler: (eventName: string) => handlers.get(eventName)!,
  };
  return app;
}

describe('registerAppUninstalledEvent', () => {
  let mockApp: ReturnType<typeof createMockApp>;

  beforeEach(() => {
    mockApp = createMockApp();
    mockDeleteInstallation.mockClear();
    mockDeleteInstallation.mockResolvedValue(undefined);
    registerAppUninstalledEvent(mockApp as unknown as App);
  });

  describe('app_uninstalled', () => {
    it('teamId あり → deleteInstallation が呼ばれる', async () => {
      const handler = mockApp.getHandler('app_uninstalled');
      await handler({ event: {}, context: { teamId: 'T12345', enterpriseId: undefined } });

      expect(mockDeleteInstallation).toHaveBeenCalledWith({
        teamId: 'T12345',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      });
    });

    it('teamId なし → deleteInstallation は呼ばれない', async () => {
      const handler = mockApp.getHandler('app_uninstalled');
      await handler({ event: {}, context: { teamId: undefined, enterpriseId: undefined } });

      expect(mockDeleteInstallation).not.toHaveBeenCalled();
    });

    it('deleteInstallation が失敗しても例外が外に伝播しない', async () => {
      mockDeleteInstallation.mockRejectedValue(new Error('DB error'));
      const handler = mockApp.getHandler('app_uninstalled');

      await expect(
        handler({ event: {}, context: { teamId: 'T12345', enterpriseId: undefined } })
      ).resolves.toBeUndefined();
    });
  });

  describe('tokens_revoked', () => {
    it('teamId あり → deleteInstallation が呼ばれる', async () => {
      const handler = mockApp.getHandler('tokens_revoked');
      await handler({ event: {}, context: { teamId: 'T67890', enterpriseId: 'E111' } });

      expect(mockDeleteInstallation).toHaveBeenCalledWith({
        teamId: 'T67890',
        enterpriseId: 'E111',
        isEnterpriseInstall: false,
      });
    });

    it('teamId なし → deleteInstallation は呼ばれない', async () => {
      const handler = mockApp.getHandler('tokens_revoked');
      await handler({ event: {}, context: { teamId: undefined, enterpriseId: undefined } });

      expect(mockDeleteInstallation).not.toHaveBeenCalled();
    });

    it('deleteInstallation が失敗しても例外が外に伝播しない', async () => {
      mockDeleteInstallation.mockRejectedValue(new Error('Network error'));
      const handler = mockApp.getHandler('tokens_revoked');

      await expect(
        handler({ event: {}, context: { teamId: 'T67890', enterpriseId: undefined } })
      ).resolves.toBeUndefined();
    });
  });
});
