import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, _clearKeyCache } from './crypto';

const VALID_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

describe('crypto', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = VALID_KEY;
    _clearKeyCache();
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
    _clearKeyCache();
  });

  it('encrypt/decrypt ラウンドトリップが正しく動作する', () => {
    const plaintext = 'xoxb-test-bot-token-12345';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('同じ平文でも毎回異なる暗号文を生成する', () => {
    const plaintext = 'xoxb-same-token';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
    // どちらも復号できること
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it('暗号文の改竄を検知する', () => {
    const encrypted = encrypt('secret-token');
    const parts = encrypted.split(':');
    // ciphertext 部分を改竄
    const tampered = `${parts[0]}:${parts[1]}:${Buffer.from('tampered').toString('base64')}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('ENCRYPTION_KEY 未設定でエラーになる', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
  });

  it('ENCRYPTION_KEY の長さが不正でエラーになる', () => {
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be exactly 64 hex characters');
  });
});
