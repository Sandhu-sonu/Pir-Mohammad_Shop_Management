interface RateLimitBucket {
  timestamps: number[];
}

export class RateLimiter {
  private static cache = new Map<string, RateLimitBucket>();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Evaluates if a key (e.g. IP or Username) is within rate limits.
   * @param key unique identifier (e.g., client IP)
   * @param limit maximum requests allowed in the window
   * @param windowMs window size in milliseconds
   */
  static isAllowed(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    
    // Start periodic memory cleanup if not already running
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => this.cleanup(windowMs), 5 * 60 * 1000);
      // Ensure cleanup interval doesn't hold node process open
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }

    if (!this.cache.has(key)) {
      this.cache.set(key, { timestamps: [now] });
      return true;
    }

    const bucket = this.cache.get(key)!;
    
    // Remove expired timestamps (older than now - windowMs)
    const cutoff = now - windowMs;
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    if (bucket.timestamps.length >= limit) {
      return false;
    }

    bucket.timestamps.push(now);
    return true;
  }

  /**
   * Explicitly resets a rate limit bucket (e.g., after successful login)
   */
  static reset(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Cleans up expired buckets to prevent memory leaks
   */
  private static cleanup(windowMs: number): void {
    const now = Date.now();
    const cutoff = now - windowMs;

    for (const [key, bucket] of this.cache.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
      if (bucket.timestamps.length === 0) {
        this.cache.delete(key);
      }
    }
  }
}
