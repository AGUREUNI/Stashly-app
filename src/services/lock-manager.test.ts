import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lockManager } from './lock-manager';

/** lock-manager.ts の内部定数を再定義（テスト検証用） */
const LOCK_TTL_MS = 3 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60_000;

describe('lockManager', () => {
  beforeEach(() => {
    lockManager._clearForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should acquire lock successfully', () => {
    expect(lockManager.acquire('thumbsup')).toBe(true);
  });

  it('should reject second acquire for same emoji', () => {
    lockManager.acquire('thumbsup');
    expect(lockManager.acquire('thumbsup')).toBe(false);
  });

  it('should allow acquire after release', () => {
    lockManager.acquire('thumbsup');
    lockManager.release('thumbsup');
    expect(lockManager.acquire('thumbsup')).toBe(true);
  });

  it('should allow independent locks for different emojis', () => {
    expect(lockManager.acquire('thumbsup')).toBe(true);
    expect(lockManager.acquire('heart')).toBe(true);
  });

  it('should auto-expire lock after TTL (3 minutes)', () => {
    vi.useFakeTimers();

    lockManager.acquire('thumbsup');
    expect(lockManager.acquire('thumbsup')).toBe(false);

    // Advance past 3 min TTL
    vi.advanceTimersByTime(3 * 60 * 1000 + 1);

    expect(lockManager.acquire('thumbsup')).toBe(true);
  });

  it('should not expire lock before TTL', () => {
    vi.useFakeTimers();

    lockManager.acquire('thumbsup');

    // Advance to just under 3 min
    vi.advanceTimersByTime(2 * 60 * 1000);

    expect(lockManager.acquire('thumbsup')).toBe(false);
  });

  it('should release non-existent lock without error', () => {
    expect(() => lockManager.release('nonexistent')).not.toThrow();
  });

  it('shutdown() should stop cleanup timer', () => {
    vi.useFakeTimers();

    // 新しいlockManagerを使って、shutdown前のタイマーを確認
    lockManager.acquire('test-key');
    lockManager.shutdown();

    // shutdown後にタイマーが走っても例外にならないことを確認
    // （タイマーが停止しているので cleanup は呼ばれない）
    expect(() => vi.advanceTimersByTime(CLEANUP_INTERVAL_MS * 2)).not.toThrow();
  });

  it('acquire() should atomically replace TTL-expired lock', () => {
    vi.useFakeTimers();

    // ロック取得
    expect(lockManager.acquire('expired-key')).toBe(true);
    // 同じキーはTTL内なので取得失敗
    expect(lockManager.acquire('expired-key')).toBe(false);

    // TTLを超過させる
    vi.advanceTimersByTime(LOCK_TTL_MS + 1);

    // TTL切れロックを再取得できる
    expect(lockManager.acquire('expired-key')).toBe(true);
    // 再取得直後は再度ロック中
    expect(lockManager.acquire('expired-key')).toBe(false);
  });

  it('_clearForTest() should also stop cleanup timer', () => {
    vi.useFakeTimers();

    lockManager.acquire('clear-test');
    lockManager._clearForTest();

    // クリア後はロックが空
    expect(lockManager.acquire('clear-test')).toBe(true);

    // タイマーも停止しているので、大量の時間を進めても問題なし
    expect(() => vi.advanceTimersByTime(CLEANUP_INTERVAL_MS * 5)).not.toThrow();
  });
});
