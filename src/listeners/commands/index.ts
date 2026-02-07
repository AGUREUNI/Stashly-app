import type { App } from '@slack/bolt';
import { registerCanvasCollectCommand } from './canvas-collect';

export function registerCommands(app: App): void {
  registerCanvasCollectCommand(app);
}
