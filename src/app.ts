import { App } from '@slack/bolt';
import 'dotenv/config';
import { registerCommands } from './listeners/commands';

const isSocketMode = !!process.env.SLACK_APP_TOKEN;

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  ...(isSocketMode
    ? { socketMode: true, appToken: process.env.SLACK_APP_TOKEN }
    : {}),
});

registerCommands(app);

(async () => {
  const port = Number(process.env.PORT) || 3000;
  await app.start(port);
  console.log(
    `⚡ Stashly is running (${isSocketMode ? 'Socket Mode' : `HTTP on port ${port}`})`,
  );
})();
