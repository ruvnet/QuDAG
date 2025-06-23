/**
 * @description Redis cache layer for performance optimization
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial Redis cache implementation
 */

import Redis from 'ioredis';
import { config } from './config';
import { logger } from './utils/logger';

let redis: Redis | null = null;

/**
 * @description Initialize Redis connection
 * @returns {Promise<Redis>} Redis client instance
 * @throws {Error} If connection fails
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export async function setupRedis(): Promise<Redis> {
  if (redis) {
    return redis;
  }

  try {
    redis = new Redis(config.redis.url, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      },
      maxRetriesPerRequest: 3,
    });

    redis.on('error', (err) => {
      logger.error(err, 'Redis error');
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    // Test connection
    await redis.ping();

    return redis;
  } catch (error) {
    logger.error(error, 'Failed to connect to Redis');
    throw error;
  }
}

/**
 * @description Get Redis client instance
 * @returns {Redis} Redis client
 * @throws {Error} If Redis not initialized
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not initialized. Call setupRedis() first.');
  }
  return redis;
}

/**
 * @description Cache wrapper with automatic serialization
 * @param {string} key - Cache key
 * @param {Function} fn - Function to execute if cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<T>} Cached or fresh data
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const client = getRedis();
  
  try {
    // Try to get from cache
    const cached = await client.get(key);
    if (cached) {
      logger.debug({ key }, 'Cache hit');
      return JSON.parse(cached);
    }
    
    // Cache miss - execute function
    logger.debug({ key }, 'Cache miss');
    const result = await fn();
    
    // Store in cache
    if (ttl) {
      await client.set(key, JSON.stringify(result), 'EX', ttl);
    } else {
      await client.set(key, JSON.stringify(result));
    }
    
    return result;
  } catch (error) {
    logger.error({ error, key }, 'Cache operation failed');
    // On error, just execute the function
    return fn();
  }
}

/**
 * @description Invalidate cache entries by pattern
 * @param {string} pattern - Redis key pattern (e.g., 'org:*:metrics')
 * @returns {Promise<number>} Number of keys deleted
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export async function invalidateCache(pattern: string): Promise<number> {
  const client = getRedis();
  const keys = await client.keys(pattern);
  
  if (keys.length === 0) {
    return 0;
  }
  
  const deleted = await client.del(...keys);
  logger.info({ pattern, deleted }, 'Cache invalidated');
  
  return deleted;
}

/**
 * @description Close Redis connection
 * @returns {Promise<void>}
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis connection closed');
  }
}

// Cache key generators for consistency
export const cacheKeys = {
  organization: (id: string) => `org:${id}`,
  department: (orgId: string, deptId: string) => `org:${orgId}:dept:${deptId}`,
  agent: (agentId: string) => `agent:${agentId}`,
  agentPerformance: (agentId: string, date: string) => `agent:${agentId}:perf:${date}`,
  metrics: (orgId: string, type: string, date: string) => `org:${orgId}:metrics:${type}:${date}`,
  dashboard: (id: string) => `dashboard:${id}`,
  report: (id: string) => `report:${id}`,
} as const;