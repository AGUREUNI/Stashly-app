import type { App } from '@slack/bolt';
import { installationStore } from '../../services/installation-store';

/**
 * アンインストール共通処理
 * teamId チェック → deleteInstallation → エラー保護
 */
async function handleUninstall(
  teamId: string | undefined,
  enterpriseId: string | undefined,
  eventName: string,
): Promise<void> {
  if (!teamId) {
    console.warn(`${eventName}: teamId not found in context`);
    return;
  }

  console.log(`${eventName}: removing installation for team: ${teamId}`);
  try {
    await installationStore.deleteInstallation!({
      teamId,
      enterpriseId,
      isEnterpriseInstall: false,
    });
  } catch (error) {
    console.error(`${eventName}: failed to delete installation for team ${teamId}:`, error);
  }
}

export function registerAppUninstalledEvent(app: App): void {
  app.event('app_uninstalled', async ({ event, context }) => {
    console.log('app_uninstalled: event received, teamId:', context.teamId);
    await handleUninstall(context.teamId, context.enterpriseId, 'app_uninstalled');
  });

  app.event('tokens_revoked', async ({ event, context }) => {
    console.log('tokens_revoked: event received, teamId:', context.teamId);
    await handleUninstall(context.teamId, context.enterpriseId, 'tokens_revoked');
  });
}
