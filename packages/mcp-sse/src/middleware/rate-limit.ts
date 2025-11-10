/**
 * Rate Limiting Middleware
 *
 * Implements token bucket algorithm for request rate limiting
 * with per-user, per-IP, and global limits.
 */

import { Request, Response, NextFunction } from "express";

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private capacity: number;
  private refillRate: number; // tokens per second
  private cleanup: NodeJS.Timer;

  constructor(requestsPerMinute: number = 600) {
    this.capacity = requestsPerMinute;
    this.refillRate = requestsPerMinute / 60; // Convert to per-second

    // Cleanup old buckets every 5 minutes
    this.cleanup = setInterval(() => this.cleanupBuckets(), 300000);
  }

  /**
   * Get client identifier (IP address or user ID)
   */
  private getClientId(req: Request): string {
    return req.user?.user_id || req.ip || "anonymous";
  }

  /**
   * Refill bucket based on time elapsed
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const timePassed = (now - bucket.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = timePassed * this.refillRate;

    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Check if request is allowed
   */
  public isAllowed(clientId: string, tokensRequested: number = 1): boolean {
    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      bucket = {
        tokens: this.capacity,
        lastRefill: Date.now()
      };
      this.buckets.set(clientId, bucket);
    }

    // Refill bucket
    this.refillBucket(bucket);

    // Check if enough tokens
    if (bucket.tokens >= tokensRequested) {
      bucket.tokens -= tokensRequested;
      return true;
    }

    return false;
  }

  /**
   * Get time to wait before next request is allowed
   */
  public getRetryAfter(clientId: string, tokensRequested: number = 1): number {
    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      return 0;
    }

    this.refillBucket(bucket);

    if (bucket.tokens >= tokensRequested) {
      return 0;
    }

    // Calculate time needed to get enough tokens
    const tokensNeeded = tokensRequested - bucket.tokens;
    return Math.ceil((tokensNeeded / this.refillRate) * 1000); // Convert to milliseconds
  }

  /**
   * Get current bucket stats
   */
  public getBucketStats(clientId: string) {
    const bucket = this.buckets.get(clientId);
    if (!bucket) {
      return { tokens: this.capacity, rate: this.refillRate };
    }

    this.refillBucket(bucket);
    return {
      tokens: Math.floor(bucket.tokens),
      rate: this.refillRate,
      capacity: this.capacity
    };
  }

  /**
   * Cleanup old buckets to prevent memory leak
   */
  private cleanupBuckets(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [clientId, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(clientId);
      }
    }
  }

  /**
   * Destroy the limiter and cleanup interval
   */
  public destroy(): void {
    clearInterval(this.cleanup);
  }
}

/**
 * Express middleware for rate limiting
 */
export function createRateLimitMiddleware(requestsPerMinute: number = 600) {
  const limiter = new RateLimiter(requestsPerMinute);

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.user?.user_id || req.ip || "anonymous";
    const stats = limiter.getBucketStats(clientId);

    // Set rate limit headers
    res.set({
      "X-RateLimit-Limit": limiter["capacity"].toString(),
      "X-RateLimit-Remaining": Math.floor(stats.tokens).toString(),
      "X-RateLimit-Reset": new Date(Date.now() + 60000).toISOString()
    });

    // Check rate limit
    if (!limiter.isAllowed(clientId)) {
      const retryAfter = limiter.getRetryAfter(clientId);
      res.set("Retry-After", Math.ceil(retryAfter / 1000).toString());

      return res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again after ${retryAfter}ms`,
        retry_after: retryAfter
      });
    }

    next();
  };
}
