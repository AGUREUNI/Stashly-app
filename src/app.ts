import { App } from '@slack/bolt';
import 'dotenv/config';
import { registerCommands } from './listeners/commands';

const isSocketMode = !!process.env.SLACK_APP_TOKEN;
const isOAuthMode = !!process.env.SLACK_CLIENT_ID;

function createApp(): App {
  // Mode 1: Socket Mode（ローカル開発用）
  if (isSocketMode) {
    return new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: true,
      appToken: process.env.SLACK_APP_TOKEN,
    });
  }

  // Mode 2: OAuth Mode（本番マルチテナント）
  if (isOAuthMode) {
    // 動的 import を避けるため、起動時にチェックだけ行う
    // installation-store は OAuth モード時のみ import
    const { installationStore } = require('./services/installation-store');

    return new App({
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      stateSecret: process.env.SLACK_STATE_SECRET,
      scopes: [
        'commands',
        'channels:history',
        'channels:read',
        'groups:history',
        'groups:read',
        'reactions:read',
        'users:read',
        'canvases:write',
        'canvases:read',
        'files:read',
        'chat:write',
      ],
      installationStore,
      installerOptions: {
        directInstall: true,
      },
    });
  }

  // Mode 3: HTTP Single-tenant（フォールバック）
  return new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });
}

const app = createApp();

registerCommands(app);

// イベントリスナーは OAuth モード時のみ登録
if (isOAuthMode) {
  const { registerEvents } = require('./listeners/events');
  registerEvents(app);
}

(async () => {
  const port = Number(process.env.PORT) || 3000;

  // OAuth モード時は Prisma 接続
  if (isOAuthMode) {
    const { prisma } = require('./services/installation-store');
    await prisma.$connect();
    console.log('Connected to database');
  }

  await app.start(port);

  const mode = isSocketMode
    ? 'Socket Mode'
    : isOAuthMode
      ? `OAuth Mode (HTTP on port ${port})`
      : `HTTP on port ${port}`;
  console.log(`⚡ Stashly is running (${mode})`);
})();

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down...`);
  try {
    await app.stop();
    if (isOAuthMode) {
      const { prisma } = require('./services/installation-store');
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
