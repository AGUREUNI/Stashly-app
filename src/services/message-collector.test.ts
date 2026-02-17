import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectMessages, resolveChannelNames } from './message-collector';
import { createMockClient } from '../test-helpers/mock-client';

describe('collectMessages', () => {
  it('should collect messages with matching reactions', async () => {
    const client = createMockClient();
    // Bot is in the channel
    client.users.conversations.mockResolvedValue({
      channels: [{ id: 'C123' }],
      response_metadata: {},
    });
    client.conversations.info.mockResolvedValue({ channel: { name: 'general' } });
    client.conversations.history.mockResolvedValue({
      messages: [
        { ts: '1000.000', reactions: [{ name: 'thumbsup', count: 1 }] },
        { ts: '2000.000', reactions: [{ name: 'heart', count: 1 }] },
        { ts: '3000.000', reactions: [{ name: 'thumbsup', count: 2 }] },
      ],
      response_metadata: {},
    });
    client.chat.getPermalink.mockResolvedValue({ permalink: 'https://link' });

    const result = await collectMessages(client, 'thumbsup', ['C123'], null);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].ts).toBe('1000.000');
    expect(result.messages[1].ts).toBe('3000.000');
  });

  it('should skip channels where bot is not a member', async () => {
    const client = createMockClient();
    // Bot is NOT in C999
    client.users.conversations.mockResolvedValue({
      channels: [{ id: 'C123' }],
      response_metadata: {},
    });
    client.conversations.info.mockResolvedValue({ channel: { name: 'secret' } });
    client.conversations.history.mockResolvedValue({
      messages: [],
      response_metadata: {},
    });

    const result = await collectMessages(client, 'thumbsup', ['C999'], null);
    expect(result.messages).toHaveLength(0);
    expect(result.skippedChannels).toHaveLength(1);
    expect(result.skippedChannels[0].name).toBe('secret');
  });

  it('should return empty result when no messages match', async () => {
    const client = createMockClient();
    client.users.conversations.mockResolvedValue({
      channels: [{ id: 'C123' }],
      response_metadata: {},
    });
    client.conversations.info.mockResolvedValue({ channel: { name: 'general' } });
    client.conversations.history.mockResolvedValue({
      messages: [
        { ts: '1000.000', reactions: [{ name: 'heart', count: 1 }] },
      ],
      response_metadata: {},
    });

    const result = await collectMessages(client, 'thumbsup', ['C123'], null);
    expect(result.messages).toHaveLength(0);
  });

  it('should sort messages by ts ascending', async () => {
    const client = createMockClient();
    client.users.conversations.mockResolvedValue({
      channels: [{ id: 'C1' }, { id: 'C2' }],
      response_metadata: {},
    });
    client.conversations.info
      .mockResolvedValueOnce({ channel: { name: 'ch1' } })
      .mockResolvedValueOnce({ channel: { name: 'ch2' } });
    client.conversations.history
      .mockResolvedValueOnce({
        messages: [{ ts: '3000.000', reactions: [{ name: 'star', count: 1 }] }],
        response_metadata: {},
      })
      .mockResolvedValueOnce({
        messages: [{ ts: '1000.000', reactions: [{ name: 'star', count: 1 }] }],
        response_metadata: {},
      });
    client.chat.getPermalink.mockResolvedValue({ permalink: 'https://link' });

    const result = await collectMessages(client, 'star', ['C1', 'C2'], null);
    expect(result.messages[0].ts).toBe('1000.000');
    expect(result.messages[1].ts).toBe('3000.000');
  });

  it('should collect from thread replies', async () => {
    const client = createMockClient();
    client.users.conversations.mockResolvedValue({
      channels: [{ id: 'C123' }],
      response_metadata: {},
    });
    client.conversations.info.mockResolvedValue({ channel: { name: 'general' } });
    client.conversations.history.mockResolvedValue({
      messages: [
        { ts: '1000.000', reply_count: 2 },
      ],
      response_metadata: {},
    });
    client.conversations.replies.mockResolvedValue({
      messages: [
        { ts: '1000.000' }, // parent — should be skipped
        { ts: '1001.000', reactions: [{ name: 'thumbsup', count: 1 }] },
        { ts: '1002.000', reactions: [{ name: 'heart', count: 1 }] },
      ],
      response_metadata: {},
    });
    client.chat.getPermalink.mockResolvedValue({ permalink: 'https://link' });

    const result = await collectMessages(client, 'thumbsup', ['C123'], null);
    // Only thread reply with thumbsup should be collected (parent has no reaction)
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].ts).toBe('1001.000');
  });

  it('should handle pagination in conversations.history', async () => {
    const client = createMockClient();
    client.users.conversations.mockResolvedValue({
      channels: [{ id: 'C123' }],
      response_metadata: {},
    });
    client.conversations.info.mockResolvedValue({ channel: { name: 'general' } });
    client.conversations.history
      .mockResolvedValueOnce({
        messages: [{ ts: '1000.000', reactions: [{ name: 'star', count: 1 }] }],
        response_metadata: { next_cursor: 'page2' },
      })
      .mockResolvedValueOnce({
        messages: [{ ts: '2000.000', reactions: [{ name: 'star', count: 1 }] }],
        response_metadata: {},
      });
    client.chat.getPermalink.mockResolvedValue({ permalink: 'https://link' });

    const result = await collectMessages(client, 'star', ['C123'], null);
    expect(result.messages).toHaveLength(2);
  });

  it('should handle messages without reactions', async () => {
    const client = createMockClient();
    client.users.conversations.mockResolvedValue({
      channels: [{ id: 'C123' }],
      response_metadata: {},
    });
    client.conversations.info.mockResolvedValue({ channel: { name: 'general' } });
    client.conversations.history.mockResolvedValue({
      messages: [
        { ts: '1000.000' }, // no reactions property
        { ts: '2000.000', reactions: [] },
      ],
      response_metadata: {},
    });

    const result = await collectMessages(client, 'thumbsup', ['C123'], null);
    expect(result.messages).toHaveLength(0);
  });

  it('should handle empty channel list', async () => {
    const client = createMockClient();
    client.users.conversations.mockResolvedValue({
      channels: [],
      response_metadata: {},
    });

    const result = await collectMessages(client, 'thumbsup', [], null);
    expect(result.messages).toHaveLength(0);
    expect(result.skippedChannels).toHaveLength(0);
  });

  it('should handle permalink failure gracefully', async () => {
    const client = createMockClient();
    client.users.conversations.mockResolvedValue({
      channels: [{ id: 'C123' }],
      response_metadata: {},
    });
    client.conversations.info.mockResolvedValue({ channel: { name: 'general' } });
    client.conversations.history.mockResolvedValue({
      messages: [
        { ts: '1000.000', reactions: [{ name: 'thumbsup', count: 1 }] },
      ],
      response_metadata: {},
    });
    client.chat.getPermalink.mockRejectedValue(new Error('not found'));

    const result = await collectMessages(client, 'thumbsup', ['C123'], null);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].permalink).toBe('');
  });
});

describe('resolveChannelNames', () => {
  it('should resolve channel names to IDs', async () => {
    const client = createMockClient();
    client.conversations.list.mockResolvedValue({
      channels: [
        { id: 'C1', name: 'general' },
        { id: 'C2', name: 'random' },
      ],
      response_metadata: {},
    });

    const result = await resolveChannelNames(client, ['general', 'random']);
    expect(result.resolved).toEqual(['C1', 'C2']);
    expect(result.notFound).toEqual([]);
  });

  it('should report not found channels', async () => {
    const client = createMockClient();
    client.conversations.list.mockResolvedValue({
      channels: [{ id: 'C1', name: 'general' }],
      response_metadata: {},
    });

    const result = await resolveChannelNames(client, ['general', 'nonexistent']);
    expect(result.resolved).toEqual(['C1']);
    expect(result.notFound).toEqual(['nonexistent']);
  });

  it('should return empty arrays for empty input', async () => {
    const client = createMockClient();
    const result = await resolveChannelNames(client, []);
    expect(result.resolved).toEqual([]);
    expect(result.notFound).toEqual([]);
  });

  it('should handle pagination in conversations.list', async () => {
    const client = createMockClient();
    client.conversations.list
      .mockResolvedValueOnce({
        channels: [{ id: 'C1', name: 'general' }],
        response_metadata: { next_cursor: 'page2' },
      })
      .mockResolvedValueOnce({
        channels: [{ id: 'C2', name: 'random' }],
        response_metadata: {},
      });

    const result = await resolveChannelNames(client, ['random']);
    expect(result.resolved).toEqual(['C2']);
  });
});
