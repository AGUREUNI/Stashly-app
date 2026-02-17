import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMarkdown, buildAppendMarkdown } from './markdown-builder';
import type { CollectedMessage } from '../types';

describe('buildMarkdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 1, 8, 12, 0, 0)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleMessages: CollectedMessage[] = [
    {
      ts: '1738745400.000000', // 2025-02-05 06:30 UTC
      channelId: 'C123',
      channelName: 'general',
      permalink: 'https://slack.com/archives/C123/p1738745400',
    },
    {
      ts: '1738831800.000000', // 2025-02-06 06:30 UTC
      channelId: 'C123',
      channelName: 'general',
      permalink: 'https://slack.com/archives/C123/p1738831800',
    },
  ];

  it('should include heading with emoji (ja)', () => {
    const md = buildMarkdown('ja', 'thumbsup', sampleMessages);
    expect(md).toContain('## :thumbsup: どんぐり収集結果');
  });

  it('should include heading with emoji (en)', () => {
    const md = buildMarkdown('en', 'thumbsup', sampleMessages);
    expect(md).toContain('## :thumbsup: Acorn Collection Results');
  });

  it('should include last updated datetime', () => {
    const md = buildMarkdown('ja', 'thumbsup', sampleMessages);
    expect(md).toContain('2026-02-08 12:00 (UTC)');
  });

  it('should include message count', () => {
    const md = buildMarkdown('ja', 'thumbsup', sampleMessages);
    expect(md).toContain('2');
  });

  it('should include target channels count when provided', () => {
    const md = buildMarkdown('ja', 'thumbsup', sampleMessages, 3);
    expect(md).toContain('3');
  });

  it('should not include target channels when not provided', () => {
    const md = buildMarkdown('ja', 'thumbsup', sampleMessages);
    expect(md).not.toContain('対象チャンネル');
  });

  it('should group by channel name', () => {
    const multiChannel: CollectedMessage[] = [
      { ts: '1738745400.000000', channelId: 'C1', channelName: 'general', permalink: 'https://link1' },
      { ts: '1738745500.000000', channelId: 'C2', channelName: 'random', permalink: 'https://link2' },
    ];
    const md = buildMarkdown('ja', 'thumbsup', multiChannel);
    expect(md).toContain('### #general');
    expect(md).toContain('### #random');
  });

  it('should group by date within channel', () => {
    const md = buildMarkdown('ja', 'thumbsup', sampleMessages);
    expect(md).toContain('**2025-02-05**');
    expect(md).toContain('**2025-02-06**');
  });

  it('should include permalink with viewMessage fallback when no userName/textPreview', () => {
    const md = buildMarkdown('ja', 'thumbsup', sampleMessages);
    expect(md).toContain('[:link: メッセージを見る](https://slack.com/archives/C123/p1738745400)');
  });

  it('should include userName and textPreview in link when available', () => {
    const msgs: CollectedMessage[] = [
      {
        ts: '1738745400.000000',
        channelId: 'C123',
        channelName: 'general',
        permalink: 'https://slack.com/archives/C123/p1738745400',
        userName: '井上龍雅',
        textPreview: 'テストメッセージです',
      },
    ];
    const md = buildMarkdown('ja', 'thumbsup', msgs);
    expect(md).toContain('[井上龍雅: "テストメッセージです"](https://slack.com/archives/C123/p1738745400)');
  });

  it('should handle messages without permalink', () => {
    const msgs: CollectedMessage[] = [
      { ts: '1738745400.000000', channelId: 'C1', channelName: 'general', permalink: '' },
    ];
    const md = buildMarkdown('ja', 'thumbsup', msgs);
    expect(md).toContain('(リンク取得失敗)');
  });

  it('should return empty group section for no messages', () => {
    const md = buildMarkdown('ja', 'thumbsup', []);
    expect(md).toContain('## :thumbsup: どんぐり収集結果');
    expect(md).toContain('0');
  });
});

describe('buildAppendMarkdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 1, 8, 12, 0, 0)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with horizontal rule', () => {
    const md = buildAppendMarkdown('ja', 'thumbsup', []);
    expect(md.startsWith('---')).toBe(true);
  });

  it('should contain the same content as buildMarkdown', () => {
    const msgs: CollectedMessage[] = [
      { ts: '1738745400.000000', channelId: 'C1', channelName: 'general', permalink: 'https://link1' },
    ];
    const md = buildAppendMarkdown('ja', 'thumbsup', msgs);
    expect(md).toContain('## :thumbsup: どんぐり収集結果');
  });
});
