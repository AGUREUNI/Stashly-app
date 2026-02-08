import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { slackTsToDate, formatDateUTC, formatDateOnlyUTC, daysAgoToSlackTs } from './date';

describe('slackTsToDate', () => {
  it('should convert Slack timestamp to Date', () => {
    // 1738745400 = 2025-02-05T06:30:00.000Z
    const date = slackTsToDate('1738745400.123456');
    expect(date).toBeInstanceOf(Date);
    // parseFloat('1738745400.123456') * 1000 → milliseconds (fractional μs truncated by Date)
    expect(date.getTime()).toBe(1738745400123);
  });

  it('should handle integer timestamps', () => {
    const date = slackTsToDate('1000000000.000000');
    expect(date.getTime()).toBe(1000000000000);
  });
});

describe('formatDateUTC', () => {
  it('should format date as UTC string', () => {
    const date = new Date(Date.UTC(2026, 1, 5, 6, 30));
    expect(formatDateUTC(date)).toBe('2026-02-05 06:30 (UTC)');
  });

  it('should zero-pad month, day, hour, minute', () => {
    const date = new Date(Date.UTC(2026, 0, 1, 1, 5));
    expect(formatDateUTC(date)).toBe('2026-01-01 01:05 (UTC)');
  });
});

describe('formatDateOnlyUTC', () => {
  it('should format date as YYYY-MM-DD', () => {
    const date = new Date(Date.UTC(2026, 11, 25, 23, 59));
    expect(formatDateOnlyUTC(date)).toBe('2026-12-25');
  });

  it('should zero-pad single digit month and day', () => {
    const date = new Date(Date.UTC(2026, 0, 3));
    expect(formatDateOnlyUTC(date)).toBe('2026-01-03');
  });
});

describe('daysAgoToSlackTs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-02-08 00:00:00 UTC
    vi.setSystemTime(new Date(Date.UTC(2026, 1, 8, 0, 0, 0)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return Slack timestamp for N days ago', () => {
    const ts = daysAgoToSlackTs(7);
    const expected = new Date(Date.UTC(2026, 1, 1, 0, 0, 0)).getTime() / 1000;
    expect(ts).toBe(String(expected));
  });

  it('should return Slack timestamp for 1 day ago', () => {
    const ts = daysAgoToSlackTs(1);
    const expected = new Date(Date.UTC(2026, 1, 7, 0, 0, 0)).getTime() / 1000;
    expect(ts).toBe(String(expected));
  });

  it('should return current time for 0 days ago', () => {
    const ts = daysAgoToSlackTs(0);
    const expected = new Date(Date.UTC(2026, 1, 8, 0, 0, 0)).getTime() / 1000;
    expect(ts).toBe(String(expected));
  });
});
