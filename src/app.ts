import { App } from '@slack/bolt';
import 'dotenv/config';
import { registerCommands } from './listeners/commands';
import { lockManager } from './services/lock-manager';

const isSocketMode = !!process.env.SLACK_APP_TOKEN;
const isOAuthMode = !!process.env.SLACK_CLIENT_ID;

function validateEnvVars(required: string[], mode: string): void {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables for ${mode}: ${missing.join(', ')}`);
    process.exit(1);
  }
}

/** HTTP系モード用ヘルスチェックルート */
const healthRoute = {
  path: '/health' as const,
  method: 'GET' as const,
  handler: (_req: any, res: any) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  },
};

function createApp(): App {
  // Mode 1: Socket Mode（ローカル開発用）
  if (isSocketMode) {
    validateEnvVars(['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN'], 'Socket Mode');
    return new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: true,
      appToken: process.env.SLACK_APP_TOKEN,
    });
  }

  // Mode 2: OAuth Mode（本番マルチテナント）
  if (isOAuthMode) {
    validateEnvVars(
      ['SLACK_SIGNING_SECRET', 'SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_STATE_SECRET', 'DATABASE_URL', 'ENCRYPTION_KEY'],
      'OAuth Mode',
    );
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
      customRoutes: [healthRoute],
    });
  }

  // Mode 3: HTTP Single-tenant（フォールバック）
  validateEnvVars(['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'], 'HTTP Single-tenant');
  return new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    customRoutes: [healthRoute],
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
})().catch(err => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down...`);
  try {
    lockManager.shutdown();
    await app.stop();
    if (isOAuthMode) {
      const { prisma } = require('./services/installation-store');
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Error during shutdown:', error instanceof Error ? error.message : 'Unknown error');
  }
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason instanceof Error ? reason.message : 'Unknown rejection');
});
