import { describe, it, expect } from 'vitest';
import { AppError } from './index';

describe('AppError', () => {
  it('should create with kind and message', () => {
    const err = new AppError('PARSE_ERROR', 'test message');
    expect(err.kind).toBe('PARSE_ERROR');
    expect(err.message).toBe('test message');
    expect(err.detail).toBeUndefined();
    expect(err.messageKey).toBeUndefined();
  });

  it('should create with detail and messageKey', () => {
    const err = new AppError('FATAL_API_ERROR', 'msg', 'missing_scope', 'error.missingScope');
    expect(err.kind).toBe('FATAL_API_ERROR');
    expect(err.detail).toBe('missing_scope');
    expect(err.messageKey).toBe('error.missingScope');
  });

  it('should be instance of Error', () => {
    const err = new AppError('UNKNOWN', 'test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('should have name set to AppError', () => {
    const err = new AppError('LOCK_CONFLICT', 'locked');
    expect(err.name).toBe('AppError');
  });

  it('should support all ErrorKind values', () => {
    const kinds = [
      'PARSE_ERROR', 'NO_EMOJI', 'MULTIPLE_PERIODS', 'LOCK_CONFLICT',
      'NOT_IN_CHANNEL', 'CANVAS_CREATE_FAILED', 'CANVAS_EDIT_FAILED',
      'RATE_LIMITED', 'FATAL_API_ERROR', 'UNKNOWN',
    ] as const;

    for (const kind of kinds) {
      const err = new AppError(kind, 'msg');
      expect(err.kind).toBe(kind);
    }
  });
});
