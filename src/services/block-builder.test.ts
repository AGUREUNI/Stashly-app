import { describe, it, expect } from 'vitest';
import {
  buildCollectingBlocks,
  buildCompletionBlocks,
  buildNoResultBlocks,
  buildErrorBlocks,
  buildLockConflictBlocks,
} from './block-builder';

describe('buildCollectingBlocks', () => {
  it('should return section block with emoji and channel count (ja)', () => {
    const blocks = buildCollectingBlocks('ja', 'thumbsup', 3);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('section');
    const text = (blocks[0] as any).text.text;
    expect(text).toContain(':thumbsup:');
    expect(text).toContain('3');
  });

  it('should return localized message (en)', () => {
    const blocks = buildCollectingBlocks('en', 'heart', 5);
    const text = (blocks[0] as any).text.text;
    expect(text).toContain(':heart:');
    expect(text).toContain('5 channels');
  });
});

describe('buildCompletionBlocks', () => {
  it('should include header and body', () => {
    const blocks = buildCompletionBlocks('ja', 'thumbsup', 42, 'https://canvas.url');
    const types = blocks.map(b => b.type);
    expect(types).toContain('header');
    expect(types).toContain('section');
  });

  it('should include canvas URL in body', () => {
    const blocks = buildCompletionBlocks('ja', 'thumbsup', 10, 'https://example.com/canvas');
    const body = blocks.find(b => b.type === 'section' && (b as any).text?.text?.includes('https://example.com/canvas'));
    expect(body).toBeTruthy();
  });

  it('should include limit warning when limitReachedChannels provided', () => {
    const blocks = buildCompletionBlocks('ja', 'thumbsup', 500, 'https://url', {
      limitReachedChannels: ['general'],
    });
    const texts = blocks.map(b => (b as any).text?.text ?? '').join(' ');
    expect(texts).toContain('500');
  });

  it('should include skipped channels context', () => {
    const blocks = buildCompletionBlocks('ja', 'thumbsup', 10, 'https://url', {
      skippedChannels: [{ id: 'C1', name: 'secret' }],
    });
    const contextBlocks = blocks.filter(b => b.type === 'context');
    const texts = contextBlocks.map(b => (b as any).elements?.map((e: any) => e.text).join(' ')).join(' ');
    expect(texts).toContain('#secret');
  });

  it('should always include divider and hint', () => {
    const blocks = buildCompletionBlocks('ja', 'thumbsup', 10, 'https://url');
    const types = blocks.map(b => b.type);
    expect(types).toContain('divider');
    // hint is a context block
    expect(types.filter(t => t === 'context').length).toBeGreaterThanOrEqual(1);
  });

  it('should render English locale', () => {
    const blocks = buildCompletionBlocks('en', 'star', 5, 'https://url');
    const headerBlock = blocks.find(b => b.type === 'header');
    expect((headerBlock as any).text.text).toBe('Collection Complete');
  });
});

describe('buildNoResultBlocks', () => {
  it('should return section with no-result message', () => {
    const blocks = buildNoResultBlocks('ja');
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as any).text.text).toContain('該当するメッセージが見つかりません');
  });

  it('should include skipped channels when provided', () => {
    const blocks = buildNoResultBlocks('ja', [{ id: 'C1', name: 'private' }]);
    expect(blocks.length).toBeGreaterThan(1);
    const ctxBlock = blocks.find(b => b.type === 'context');
    const text = (ctxBlock as any).elements[0].text;
    expect(text).toContain('#private');
  });

  it('should render English locale', () => {
    const blocks = buildNoResultBlocks('en');
    expect((blocks[0] as any).text.text).toContain('No matching messages found');
  });
});

describe('buildErrorBlocks', () => {
  it('should return section with error message', () => {
    const blocks = buildErrorBlocks('Something went wrong');
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as any).text.text).toBe('Something went wrong');
  });
});

describe('buildLockConflictBlocks', () => {
  it('should return section with lock conflict message (ja)', () => {
    const blocks = buildLockConflictBlocks('ja', 'thumbsup');
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as any).text.text).toContain(':thumbsup:');
  });

  it('should render English locale', () => {
    const blocks = buildLockConflictBlocks('en', 'heart');
    expect((blocks[0] as any).text.text).toContain(':heart:');
    expect((blocks[0] as any).text.text).toContain('already gathering');
  });
});
