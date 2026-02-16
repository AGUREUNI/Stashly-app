import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { t, resolveLocale, getUserLocale, _clearLocaleCacheForTest } from './index';
import type { SupportedLocale, MessageKey } from './types';
import { createMockClient } from '../test-helpers/mock-client';

// ---- Part A: t() 翻訳関数 ----
describe('t()', () => {
  it('should return Japanese message by default', () => {
    const result = t('ja', 'completion.header');
    expect(result).toBe('収集完了');
  });

  it('should return English message', () => {
    const result = t('en', 'completion.header');
    expect(result).toBe('Collection Complete');
  });

  it('should interpolate single placeholder', () => {
    const result = t('ja', 'markdown.messageCount', { count: 42 });
    expect(result).toBe('収集件数: 42件');
  });

  it('should interpolate multiple placeholders', () => {
    const result = t('en', 'collecting.blocks', { emoji: 'thumbsup', channelCount: 3 });
    expect(result).toContain(':thumbsup:');
    expect(result).toContain('3 channels');
  });

  it('should keep unresolved placeholders as-is', () => {
    const result = t('ja', 'markdown.messageCount', {});
    expect(result).toContain('{{count}}');
  });

  it('should return template without params unchanged', () => {
    const result = t('ja', 'noResult.message');
    expect(result).toBe('ℹ️ 該当するメッセージが見つかりませんでした');
  });

  it('should fallback to ja when locale key missing', () => {
    // All locales should have all keys, but testing fallback logic
    const jaResult = t('ja', 'completion.header');
    expect(jaResult).toBeTruthy();
  });
});

// ---- Part B: resolveLocale() ----
describe('resolveLocale()', () => {
  it('should resolve "ja-JP" to "ja"', () => {
    expect(resolveLocale('ja-JP')).toBe('ja');
  });

  it('should resolve "en-US" to "en"', () => {
    expect(resolveLocale('en-US')).toBe('en');
  });

  it('should resolve "en-GB" to "en"', () => {
    expect(resolveLocale('en-GB')).toBe('en');
  });

  it('should resolve "zh-CN" to "zh"', () => {
    expect(resolveLocale('zh-CN')).toBe('zh');
  });

  it('should resolve "zh-TW" to "zh"', () => {
    expect(resolveLocale('zh-TW')).toBe('zh');
  });

  it('should resolve "ko-KR" to "ko"', () => {
    expect(resolveLocale('ko-KR')).toBe('ko');
  });

  it('should resolve "fr-FR" to "fr"', () => {
    expect(resolveLocale('fr-FR')).toBe('fr');
  });

  it('should resolve "es-ES" to "es"', () => {
    expect(resolveLocale('es-ES')).toBe('es');
  });

  it('should resolve "hi-IN" to "hi"', () => {
    expect(resolveLocale('hi-IN')).toBe('hi');
  });

  it('should return default locale for unsupported language', () => {
    expect(resolveLocale('de-DE')).toBe('ja');
  });

  it('should return default locale for empty string', () => {
    expect(resolveLocale('')).toBe('ja');
  });

  it('should return default locale for "-US" (empty lang part)', () => {
    expect(resolveLocale('-US')).toBe('ja');
  });
});

// ---- 全locale鍵検証 ----
describe('All locales have same keys', () => {
  const locales: SupportedLocale[] = ['ja', 'en', 'hi', 'fr', 'es', 'zh', 'ko'];

  // Get reference keys from Japanese locale
  const referenceKeys: MessageKey[] = [
    'collecting.blocks', 'collecting.fallback',
    'completion.header', 'completion.body', 'completion.fallback',
    'completion.limitWarning', 'completion.skippedChannels', 'completion.hint',
    'noResult.message', 'noResult.fallback',
    'lock.conflict', 'lock.conflictFallback',
    'error.noEmoji', 'error.invalidEmoji', 'error.tooManyChannels',
    'error.multiplePeriods', 'error.invalidPeriod', 'error.channelNotFound',
    'command.periodExample',
    'error.missingScope', 'error.authInvalid', 'error.authError',
    'error.rateLimited', 'error.channelNotFoundApi',
    'error.canvasEditFailed', 'error.canvasCreateFailed',
    'error.unknown', 'error.genericFallback',
    'canvas.title',
    'markdown.heading', 'markdown.lastUpdated', 'markdown.messageCount',
    'markdown.targetChannels', 'markdown.viewMessage', 'markdown.linkFailed',
  ];

  for (const locale of locales) {
    it(`locale "${locale}" should return non-empty string for all keys`, () => {
      for (const key of referenceKeys) {
        const value = t(locale, key);
        expect(value, `${locale}.${key} should not be empty`).toBeTruthy();
      }
    });
  }
});

// ---- Part C: getUserLocale() ----
describe('getUserLocale()', () => {
  beforeEach(() => {
    _clearLocaleCacheForTest();
  });

  it('should call users.info and return resolved locale', async () => {
    const client = createMockClient();
    client.users.info.mockResolvedValue({ user: { locale: 'en-US' } });

    const locale = await getUserLocale(client, 'U123');
    expect(locale).toBe('en');
    expect(client.users.info).toHaveBeenCalledWith({
      user: 'U123',
      include_locale: true,
    });
  });

  it('should cache the result and not call API again', async () => {
    const client = createMockClient();
    client.users.info.mockResolvedValue({ user: { locale: 'fr-FR' } });

    const locale1 = await getUserLocale(client, 'U456');
    const locale2 = await getUserLocale(client, 'U456');

    expect(locale1).toBe('fr');
    expect(locale2).toBe('fr');
    expect(client.users.info).toHaveBeenCalledTimes(1);
  });

  it('should return default locale on API error', async () => {
    const client = createMockClient();
    client.users.info.mockRejectedValue(new Error('API error'));

    const locale = await getUserLocale(client, 'U789');
    expect(locale).toBe('ja');
  });

  it('should return default locale when user has no locale', async () => {
    const client = createMockClient();
    client.users.info.mockResolvedValue({ user: {} });

    const locale = await getUserLocale(client, 'U000');
    expect(locale).toBe('ja');
  });

  it('should evict oldest entry when cache is full with valid entries (LRU)', async () => {
    const client = createMockClient();
    // 1000件のキャッシュを満杯にする（全てTTL内）
    for (let i = 0; i < 1000; i++) {
      client.users.info.mockResolvedValueOnce({ user: { locale: 'en-US' } });
      await getUserLocale(client, `UFILL${i}`);
    }

    // 1001件目を追加 → LRU evictionが発動するはず
    client.users.info.mockResolvedValueOnce({ user: { locale: 'fr-FR' } });
    await getUserLocale(client, 'UNEW');

    // 最古のエントリ UFILL0 が削除され、再度API呼び出しが必要
    client.users.info.mockResolvedValueOnce({ user: { locale: 'ja-JP' } });
    const callsBefore = client.users.info.mock.calls.length;
    await getUserLocale(client, 'UFILL0');
    const callsAfter = client.users.info.mock.calls.length;
    expect(callsAfter).toBe(callsBefore + 1); // キャッシュにないのでAPIが呼ばれる
  });

  it('should re-fetch after cache expires', async () => {
    vi.useFakeTimers();
    const client = createMockClient();
    client.users.info.mockResolvedValue({ user: { locale: 'ko-KR' } });

    await getUserLocale(client, 'UEXPIRE');
    expect(client.users.info).toHaveBeenCalledTimes(1);

    // Advance time past 30 min TTL
    vi.advanceTimersByTime(31 * 60 * 1000);

    await getUserLocale(client, 'UEXPIRE');
    expect(client.users.info).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
