import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lockManager } from './lock-manager';

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
});
