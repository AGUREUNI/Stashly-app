import { vi } from 'vitest';

/**
 * Slack WebClient のモックファクトリ
 * 必要なメソッドだけモック化して返す
 */
export function createMockClient(overrides: Record<string, any> = {}): any {
  return {
    conversations: {
      history: vi.fn().mockResolvedValue({ messages: [], response_metadata: {} }),
      replies: vi.fn().mockResolvedValue({ messages: [], response_metadata: {} }),
      info: vi.fn().mockResolvedValue({ channel: { name: 'general' } }),
      list: vi.fn().mockResolvedValue({ channels: [], response_metadata: {} }),
    },
    users: {
      info: vi.fn().mockResolvedValue({ user: { locale: 'ja-JP' } }),
      conversations: vi.fn().mockResolvedValue({ channels: [], response_metadata: {} }),
    },
    chat: {
      getPermalink: vi.fn().mockResolvedValue({ permalink: 'https://slack.com/archives/C123/p123' }),
      postEphemeral: vi.fn().mockResolvedValue({ ok: true }),
    },
    files: {
      list: vi.fn().mockResolvedValue({ files: [], response_metadata: {} }),
    },
    canvases: {
      create: vi.fn().mockResolvedValue({ canvas_id: 'F_CANVAS_123' }),
      edit: vi.fn().mockResolvedValue({ ok: true }),
    },
    ...overrides,
  };
}
