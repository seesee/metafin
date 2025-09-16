interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  constructor(
    private defaultCapacity = 10,
    private defaultRefillRate = 1000 // tokens per second
  ) {}

  async acquire(
    key: string,
    tokens = 1,
    customCapacity?: number,
    customRefillRate?: number
  ): Promise<boolean> {
    const capacity = customCapacity ?? this.defaultCapacity;
    const refillRate = customRefillRate ?? this.defaultRefillRate;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefill: Date.now(),
        capacity,
        refillRate,
      };
      this.buckets.set(key, bucket);
    }

    this.refillBucket(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  async waitForTokens(
    key: string,
    tokens = 1,
    customCapacity?: number,
    customRefillRate?: number
  ): Promise<void> {
    const capacity = customCapacity ?? this.defaultCapacity;
    const refillRate = customRefillRate ?? this.defaultRefillRate;

    while (!(await this.acquire(key, tokens, capacity, refillRate))) {
      const bucket = this.buckets.get(key);
      if (!bucket) {
        continue;
      }

      const tokensNeeded = tokens - bucket.tokens;
      const waitTime = (tokensNeeded * 1000) / refillRate;
      await this.sleep(Math.max(waitTime, 100));
    }
  }

  getAvailableTokens(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return this.defaultCapacity;
    }

    this.refillBucket(bucket);
    return bucket.tokens;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  resetAll(): void {
    this.buckets.clear();
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = (elapsed * bucket.refillRate) / 1000;

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
