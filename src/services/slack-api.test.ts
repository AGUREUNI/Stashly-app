import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callWithRetry, fetchAllPages, isSkippableError } from './slack-api';
import { AppError } from '../types';

describe('callWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });
    const result = await callWithRetry(fn);
    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on ratelimited error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ data: { error: 'ratelimited' } })
      .mockResolvedValue({ ok: true });

    const promise = callWithRetry(fn);
    // Advance timer to cover backoff delay
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry with exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ data: { error: 'ratelimited' } })
      .mockRejectedValueOnce({ data: { error: 'ratelimited' } })
      .mockResolvedValue({ ok: true });

    const promise = callWithRetry(fn);
    // First retry: 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    // Second retry: 2000ms
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries on ratelimited', async () => {
    const fn = vi.fn().mockRejectedValue({ data: { error: 'ratelimited' } });

    const promise = callWithRetry(fn).catch((e: unknown) => e);
    // Advance through all retries: 1000 + 2000 + 4000
    await vi.advanceTimersByTimeAsync(7000);

    const error = await promise;
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).kind).toBe('RATE_LIMITED');
  });

  it('should throw immediately for fatal errors (missing_scope)', async () => {
    const fn = vi.fn().mockRejectedValue({ data: { error: 'missing_scope' } });

    await expect(callWithRetry(fn)).rejects.toMatchObject({
      kind: 'FATAL_API_ERROR',
      messageKey: 'error.missingScope',
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw immediately for invalid_auth', async () => {
    const fn = vi.fn().mockRejectedValue({ data: { error: 'invalid_auth' } });

    await expect(callWithRetry(fn)).rejects.toMatchObject({
      kind: 'FATAL_API_ERROR',
      messageKey: 'error.authError',
    });
  });

  it('should throw immediately for token_revoked', async () => {
    const fn = vi.fn().mockRejectedValue({ data: { error: 'token_revoked' } });

    await expect(callWithRetry(fn)).rejects.toMatchObject({
      kind: 'FATAL_API_ERROR',
      messageKey: 'error.authInvalid',
    });
  });

  it('should throw NOT_IN_CHANNEL for not_in_channel', async () => {
    const fn = vi.fn().mockRejectedValue({ data: { error: 'not_in_channel' } });

    await expect(callWithRetry(fn)).rejects.toMatchObject({
      kind: 'NOT_IN_CHANNEL',
    });
  });

  it('should throw PARSE_ERROR for channel_not_found', async () => {
    const fn = vi.fn().mockRejectedValue({ data: { error: 'channel_not_found' } });

    await expect(callWithRetry(fn)).rejects.toMatchObject({
      kind: 'PARSE_ERROR',
      messageKey: 'error.channelNotFoundApi',
    });
  });

  it('should throw CANVAS_EDIT_FAILED for canvas_editing_failed', async () => {
    const fn = vi.fn().mockRejectedValue({ data: { error: 'canvas_editing_failed' } });

    await expect(callWithRetry(fn)).rejects.toMatchObject({
      kind: 'CANVAS_EDIT_FAILED',
      messageKey: 'error.canvasEditFailed',
    });
  });

  it('should throw CANVAS_CREATE_FAILED for canvas_creation_failed', async () => {
    const fn = vi.fn().mockRejectedValue({ data: { error: 'canvas_creation_failed' } });

    await expect(callWithRetry(fn)).rejects.toMatchObject({
      kind: 'CANVAS_CREATE_FAILED',
      messageKey: 'error.canvasCreateFailed',
    });
  });

  it('should throw UNKNOWN for unrecognized error codes', async () => {
    const fn = vi.fn().mockRejectedValue({ data: { error: 'some_weird_error' } });

    await expect(callWithRetry(fn)).rejects.toMatchObject({
      kind: 'UNKNOWN',
      messageKey: 'error.unknown',
    });
  });

  it('should throw UNKNOWN for errors without code', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network fail'));

    await expect(callWithRetry(fn)).rejects.toMatchObject({
      kind: 'UNKNOWN',
    });
  });

  it('should timeout after 30 seconds', async () => {
    // 永遠に解決しないPromiseを返す関数
    const fn = vi.fn().mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const promise = callWithRetry(fn).catch((e: unknown) => e);
    // 30秒のタイムアウトを発火
    await vi.advanceTimersByTimeAsync(30_000);

    const error = await promise;
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).kind).toBe('UNKNOWN');
  });
});

describe('fetchAllPages', () => {
  it('should fetch single page', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      items: [1, 2, 3],
      nextCursor: undefined,
    });

    const result = await fetchAllPages(fetcher);
    expect(result).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should fetch multiple pages', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ items: [1, 2], nextCursor: 'cursor1' })
      .mockResolvedValueOnce({ items: [3, 4], nextCursor: 'cursor2' })
      .mockResolvedValueOnce({ items: [5], nextCursor: undefined });

    const result = await fetchAllPages(fetcher);
    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('should pass cursor to fetcher', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ items: [1], nextCursor: 'abc' })
      .mockResolvedValueOnce({ items: [2], nextCursor: undefined });

    await fetchAllPages(fetcher);
    expect(fetcher).toHaveBeenCalledWith(undefined);
    expect(fetcher).toHaveBeenCalledWith('abc');
  });

  it('should return empty array for no items', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [], nextCursor: undefined });
    const result = await fetchAllPages(fetcher);
    expect(result).toEqual([]);
  });

  it('should respect MAX_TOTAL_ITEMS (10000) limit', async () => {
    // 各ページで5000件ずつ返す → 2ページ目で10000件到達 → 3ページ目は呼ばれない
    const page5000 = Array.from({ length: 5000 }, (_, i) => i);
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ items: page5000, nextCursor: 'page2' })
      .mockResolvedValueOnce({ items: page5000, nextCursor: 'page3' })
      .mockResolvedValueOnce({ items: [99999], nextCursor: undefined });

    const result = await fetchAllPages(fetcher);
    expect(result.length).toBe(10000);
    expect(fetcher).toHaveBeenCalledTimes(2); // 3ページ目は呼ばれない
  });
});

describe('isSkippableError', () => {
  it('should return true for NOT_IN_CHANNEL AppError', () => {
    const err = new AppError('NOT_IN_CHANNEL', 'not in channel');
    expect(isSkippableError(err)).toBe(true);
  });

  it('should return false for other AppError kinds', () => {
    const err = new AppError('PARSE_ERROR', 'parse error');
    expect(isSkippableError(err)).toBe(false);
  });

  it('should return false for non-AppError', () => {
    expect(isSkippableError(new Error('random'))).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isSkippableError(null)).toBe(false);
    expect(isSkippableError(undefined)).toBe(false);
  });
});
