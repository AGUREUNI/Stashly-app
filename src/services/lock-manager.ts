/** ロックのTTL（3分） */
const LOCK_TTL_MS = 3 * 60 * 1000;

interface LockEntry {
  timestamp: number;
}

/**
 * 絵文字単位のインメモリロック管理
 * 同じ絵文字の収集処理が同時に実行されるのを防ぐ
 */
class LockManager {
  private locks = new Map<string, LockEntry>();

  /**
   * ロックを取得する
   * @returns true: 取得成功, false: 既にロックされている
   */
  acquire(emoji: string): boolean {
    this.cleanup();

    if (this.locks.has(emoji)) {
      return false;
    }

    this.locks.set(emoji, { timestamp: Date.now() });
    return true;
  }

  /**
   * ロックを解除する
   */
  release(emoji: string): void {
    this.locks.delete(emoji);
  }

  /**
   * TTL切れのロックをクリーンアップ
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.locks) {
      if (now - entry.timestamp > LOCK_TTL_MS) {
        this.locks.delete(key);
      }
    }
  }
}

/** シングルトンインスタンス */
export const lockManager = new LockManager();
