/** ロックのTTL（3分） */
const LOCK_TTL_MS = 3 * 60 * 1000;

/** 定期クリーンアップ間隔（60秒） */
const CLEANUP_INTERVAL_MS = 60_000;

interface LockEntry {
  timestamp: number;
}

/**
 * 絵文字単位のインメモリロック管理
 * 同じ絵文字の収集処理が同時に実行されるのを防ぐ
 */
class LockManager {
  private locks = new Map<string, LockEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * ロックを取得する（アトミック操作）
   * @returns true: 取得成功, false: 既にロックされている
   */
  acquire(key: string): boolean {
    const now = Date.now();
    const existing = this.locks.get(key);

    // 既存ロックがTTL内ならば取得失敗
    if (existing && now - existing.timestamp <= LOCK_TTL_MS) {
      return false;
    }

    // TTL切れ or 存在しない → ロック取得
    this.locks.set(key, { timestamp: now });
    return true;
  }

  /**
   * ロックを解除する
   */
  release(key: string): void {
    this.locks.delete(key);
  }

  /**
   * シャットダウン時にクリーンアップタイマーを停止
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** テスト用: 全ロックをクリアし、タイマーも停止 */
  _clearForTest(): void {
    this.locks.clear();
    this.shutdown();
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
