import type { Messages } from '../types';

const en: Messages = {
  // Block Kit: Collecting
  'collecting.blocks': '🐿️ Gathering :{{emoji}}: acorns from *{{channelCount}} channels*... Please wait',
  'collecting.fallback': '🐿️ Gathering :{{emoji}}: acorns from {{channelCount}} channels...',
  // Block Kit: Completion
  'completion.header': 'Collection Complete',
  'completion.body': '✅ Collected *{{count}}* acorns\n\n📄 <{{canvasUrl}}|View Canvas>',
  'completion.fallback': '✅ Collected {{count}} acorns 📄 Canvas: {{canvasUrl}}',
  'completion.limitWarning': '⚠️ More than 500 messages were found\nPlease narrow the period and try again\nExample: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  'completion.skippedChannels': '⚠️ Skipped (Bot not a member): {{channels}}',
  'completion.hint': '💡 Tip: Use a period filter to avoid duplicates! Example: `/canvas-collect :{{emoji}}: {{periodExample}}`',
  // Block Kit: No results
  'noResult.message': 'ℹ️ No matching messages found',
  'noResult.fallback': 'No matching messages found',
  // Block Kit: Lock conflict
  'lock.conflict': '⏳ A squirrel is already gathering :{{emoji}}: acorns\nPlease wait and try again',
  'lock.conflictFallback': '⏳ Already gathering :{{emoji}}: acorns',
  // Command parser errors
  'error.noEmoji': 'Please specify an emoji\nExample: `/canvas-collect :thumbsup:`',
  'error.invalidEmoji': '`{{token}}` is not a valid emoji\nPlease use the `:emoji:` format',
  'error.tooManyChannels': 'You can specify up to 9 channels (10 including the current channel)',
  'error.multiplePeriods': '❌ Only one period can be specified',
  'error.invalidPeriod': 'Period must be at least 1 day',
  'error.periodTooLong': 'Period cannot exceed {{maxDays}} days',
  'error.userRateLimited': '⏳ You have reached the rate limit\nPlease wait and try again',
  'error.channelNotFound': '❌ Channel {{channels}} not found',
  // Command syntax example
  'command.periodExample': 'last 7 days',
  // API errors
  'error.missingScope': '❌ The app is missing required permissions\nPlease ask an admin to reinstall',
  'error.authInvalid': '❌ The app authentication is invalid\nPlease ask an admin to reinstall',
  'error.authError': '❌ An authentication error occurred\nPlease contact an admin',
  'error.rateLimited': '⏳ The squirrels are busy\nPlease wait and try again',
  'error.channelNotFoundApi': '❌ The specified channel was not found',
  'error.canvasEditFailed': '❌ No permission to edit the Canvas\nPlease check permissions with the channel admin',
  'error.canvasCreateFailed': '❌ Failed to create Canvas\nPlease wait and try again',
  'error.unknown': '❌ An unexpected error occurred: {{code}}',
  'error.genericFallback': '❌ An unexpected error occurred\nPlease wait and try again',
  // Canvas
  'canvas.title': ':{{emoji}}: Collection Log',
  // Markdown
  'markdown.heading': ':{{emoji}}: Acorn Collection Results',
  'markdown.lastUpdated': 'Last updated: {{datetime}}',
  'markdown.messageCount': 'Messages collected: {{count}}',
  'markdown.targetChannels': 'Target channels: {{count}}',
  'markdown.viewMessage': ':link: View message',
  'markdown.linkFailed': '(link unavailable)',
};

export default en;
