import type { App } from '@slack/bolt';
import { installationStore } from '../../services/installation-store';

export function registerAppUninstalledEvent(app: App): void {
  app.event('app_uninstalled', async ({ event, context }) => {
    const teamId = context.teamId;
    if (!teamId) {
      console.warn('app_uninstalled: teamId not found in context');
      return;
    }

    console.log(`App uninstalled from team: ${teamId}`);
    await installationStore.deleteInstallation!({
      teamId,
      enterpriseId: context.enterpriseId,
      isEnterpriseInstall: false,
    });
  });

  app.event('tokens_revoked', async ({ event, context }) => {
    const teamId = context.teamId;
    if (!teamId) {
      console.warn('tokens_revoked: teamId not found in context');
      return;
    }

    console.log(`Tokens revoked for team: ${teamId}`);
    await installationStore.deleteInstallation!({
      teamId,
      enterpriseId: context.enterpriseId,
      isEnterpriseInstall: false,
    });
  });
}
