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

  it('Invalid IV length で復号に失敗する', () => {
    // IV部分を短い（4バイト）base64に差し替え
    const encrypted = encrypt('test-token');
    const parts = encrypted.split(':');
    const shortIv = Buffer.from('abcd').toString('base64'); // 4 bytes instead of 12
    const tampered = `${shortIv}:${parts[1]}:${parts[2]}`;
    expect(() => decrypt(tampered)).toThrow('Invalid IV length');
  });

  it('Invalid AuthTag length で復号に失敗する', () => {
    // AuthTag部分を不正な長さ（8バイト）に差し替え
    const encrypted = encrypt('test-token');
    const parts = encrypted.split(':');
    const shortTag = Buffer.from('12345678').toString('base64'); // 8 bytes instead of 16
    const tampered = `${parts[0]}:${shortTag}:${parts[2]}`;
    expect(() => decrypt(tampered)).toThrow('Invalid auth tag length');
  });

  it('不正なbase64文字列で Decryption failed エラーになる', () => {
    // コロン区切り3パーツだがbase64として不正な暗号文
    const malformed = `${Buffer.alloc(12).toString('base64')}:${Buffer.alloc(16).toString('base64')}:${Buffer.from('garbage-data').toString('base64')}`;
    expect(() => decrypt(malformed)).toThrow('Decryption failed');
  });
});
