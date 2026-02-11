import type { App } from '@slack/bolt';
import { registerAppUninstalledEvent } from './app-uninstalled';

export function registerEvents(app: App): void {
  registerAppUninstalledEvent(app);
}
