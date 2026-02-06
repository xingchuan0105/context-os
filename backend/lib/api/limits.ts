import { Redis } from 'ioredis';

type RateLimitState = {
  count: number
  resetAt: number
}

// 内存回退方案（用于开发环境或 Redis 不可用时）
const memoryBuckets = new Map<string, RateLimitState>();

// Redis 客户端（懒加载）
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  // 生产环境使用 Redis，开发环境可用内存
  if (process.env.NODE_ENV === 'production') {
    if (!redisClient) {
      const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
      const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
      const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
      const REDIS_DB = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined;

      try {
        redisClient = new Redis({
          host: REDIS_HOST,
          port: REDIS_PORT,
          password: REDIS_PASSWORD,
          db: REDIS_DB,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 100, 3000);
          },
        });
      } catch (error) {
        console.error('Failed to create Redis client for rate limiting:', error);
        return null;
      }
    }
    return redisClient;
  }
  return null;
}

/**
 * 使用 Redis 进行速率限制（生产环境）
 * 或回退到内存存储（开发环境）
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (limit <= 0 || windowMs <= 0) {
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }

  const redis = getRedisClient();
  const now = Date.now();
  const resetAt = now + windowMs;

  // 使用 Redis 速率限制
  if (redis) {
    try {
      const redisKey = `ratelimit:${key}`;

      // 使用 Redis INCR 和 TTL 实现速率限制
      const count = await redis.incr(redisKey);

      if (count === 1) {
        // 第一次请求，设置过期时间
        await redis.pexpire(redisKey, windowMs);
      }

      const remaining = Math.max(0, limit - count);
      return {
        allowed: count <= limit,
        remaining,
        resetAt,
      };
    } catch (error) {
      console.error('Redis rate limit error, falling back to memory:', error);
      // 回退到内存存储
    }
  }

  // 内存回退方案
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}

export function getClientKey(req: { headers: Headers; ip?: string | null }): string {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0].trim() || req.ip || 'unknown';
  return ip;
}
