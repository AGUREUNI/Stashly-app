import { describe, it, expect } from 'vitest';
import { parseCommand } from './command-parser';
import { AppError } from '../types';

describe('parseCommand', () => {
  // ---- 絵文字抽出 ----
  describe('emoji extraction', () => {
    it('should extract simple emoji', () => {
      const result = parseCommand(':thumbsup:', 'ja');
      expect(result.emoji).toBe('thumbsup');
    });

    it('should extract emoji with underscores', () => {
      const result = parseCommand(':white_check_mark:', 'ja');
      expect(result.emoji).toBe('white_check_mark');
    });

    it('should extract emoji with numbers', () => {
      const result = parseCommand(':100:', 'ja');
      expect(result.emoji).toBe('100');
    });

    it('should throw NO_EMOJI for empty input', () => {
      expect(() => parseCommand('', 'ja')).toThrow(AppError);
      try {
        parseCommand('', 'ja');
      } catch (e) {
        expect((e as AppError).kind).toBe('NO_EMOJI');
      }
    });

    it('should throw NO_EMOJI for whitespace only', () => {
      expect(() => parseCommand('   ', 'ja')).toThrow(AppError);
    });

    it('should throw PARSE_ERROR for invalid emoji format', () => {
      expect(() => parseCommand('thumbsup', 'ja')).toThrow(AppError);
      try {
        parseCommand('thumbsup', 'ja');
      } catch (e) {
        expect((e as AppError).kind).toBe('PARSE_ERROR');
      }
    });
  });

  // ---- チャンネルパース ----
  describe('channel parsing', () => {
    it('should parse Slack auto-linked channels', () => {
      const result = parseCommand(':check: <#C1234|marketing> <#C5678|sales>', 'ja');
      expect(result.channels).toEqual(['C1234', 'C5678']);
      expect(result.channelNames).toEqual([]);
    });

    it('should parse plain text channels', () => {
      const result = parseCommand(':check: #marketing #sales', 'ja');
      expect(result.channels).toEqual([]);
      expect(result.channelNames).toEqual(['marketing', 'sales']);
    });

    it('should prefer linked channels over plain text', () => {
      const result = parseCommand(':check: <#C1234|marketing>', 'ja');
      expect(result.channels).toEqual(['C1234']);
      expect(result.channelNames).toEqual([]);
    });

    it('should handle no channels', () => {
      const result = parseCommand(':check:', 'ja');
      expect(result.channels).toEqual([]);
      expect(result.channelNames).toEqual([]);
    });

    it('should throw PARSE_ERROR for more than 9 channels', () => {
      const channels = Array.from({ length: 10 }, (_, i) => `<#C${i}|ch${i}>`).join(' ');
      expect(() => parseCommand(`:check: ${channels}`, 'ja')).toThrow(AppError);
      try {
        parseCommand(`:check: ${channels}`, 'ja');
      } catch (e) {
        expect((e as AppError).kind).toBe('PARSE_ERROR');
      }
    });
  });

  // ---- 期間パース（多言語） ----
  describe('period parsing', () => {
    it('should parse Japanese period: 過去7日', () => {
      const result = parseCommand(':check: 過去7日', 'ja');
      expect(result.periodDays).toBe(7);
    });

    it('should parse English period: last 7 days', () => {
      const result = parseCommand(':check: last 7 days', 'en');
      expect(result.periodDays).toBe(7);
    });

    it('should parse Hindi period: पिछले 7 दिन', () => {
      const result = parseCommand(':check: पिछले 7 दिन', 'hi');
      expect(result.periodDays).toBe(7);
    });

    it('should parse French period: derniers 30 jours', () => {
      const result = parseCommand(':check: derniers 30 jours', 'fr');
      expect(result.periodDays).toBe(30);
    });

    it('should parse Spanish period: últimos 14 días', () => {
      const result = parseCommand(':check: últimos 14 días', 'es');
      expect(result.periodDays).toBe(14);
    });

    it('should parse Chinese period: 过去7天', () => {
      const result = parseCommand(':check: 过去7天', 'zh');
      expect(result.periodDays).toBe(7);
    });

    it('should parse Korean period: 최근 7일', () => {
      const result = parseCommand(':check: 최근 7일', 'ko');
      expect(result.periodDays).toBe(7);
    });

    it('should return null for no period', () => {
      const result = parseCommand(':check:', 'ja');
      expect(result.periodDays).toBeNull();
    });

    it('should throw MULTIPLE_PERIODS for duplicate periods', () => {
      expect(() => parseCommand(':check: 過去7日 過去14日', 'ja')).toThrow(AppError);
      try {
        parseCommand(':check: 過去7日 過去14日', 'ja');
      } catch (e) {
        expect((e as AppError).kind).toBe('MULTIPLE_PERIODS');
      }
    });
  });

  // ---- 入力長制限 ----
  describe('input length validation', () => {
    it('should throw PARSE_ERROR for input exceeding 500 characters', () => {
      const longInput = ':check: ' + 'a'.repeat(500); // 508 chars total > 500
      expect(() => parseCommand(longInput, 'ja')).toThrow(AppError);
      try {
        parseCommand(longInput, 'ja');
      } catch (e) {
        expect((e as AppError).kind).toBe('PARSE_ERROR');
        expect((e as AppError).message).toContain('500');
      }
    });
  });

  // ---- 複合テスト ----
  describe('combined arguments', () => {
    it('should parse emoji + channels + period', () => {
      const result = parseCommand(':check: <#C1234|general> 過去7日', 'ja');
      expect(result.emoji).toBe('check');
      expect(result.channels).toEqual(['C1234']);
      expect(result.periodDays).toBe(7);
    });

    it('should parse emoji + plain channels + period', () => {
      const result = parseCommand(':check: #general last 30 days', 'en');
      expect(result.emoji).toBe('check');
      expect(result.channelNames).toEqual(['general']);
      expect(result.periodDays).toBe(30);
    });
  });
});
