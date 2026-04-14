// src/middleware/rateLimiter.ts
// Upstash Redis-backed rate limiter for auth and public endpoints
// Falls back to in-memory limiter if Redis is not configured (dev mode)

import { Request, Response, NextFunction } from 'express';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '../config/env';
import { AppError } from '../utils/response';
import { logger } from '../utils/logger';

// ── Upstash client (only if configured) ──────────────────────────────────────

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redisClient) {
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisClient;
}

// ── In-memory fallback (dev/test only) ───────────────────────────────────────

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return true; // Allowed
  }

  if (entry.count >= limit) return false; // Blocked

  entry.count++;
  return true; // Allowed
}

// ── Limiter factory ───────────────────────────────────────────────────────────

function createUpstashLimiter(limit: number, windowSeconds: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: true,
    prefix: 'outpro:rl',
  });
}

const authLimiter = createUpstashLimiter(env.RATE_LIMIT_AUTH_PER_MIN, 60);
const publicLimiter = createUpstashLimiter(env.RATE_LIMIT_PUBLIC_PER_MIN, 60);
const authedLimiter = createUpstashLimiter(env.RATE_LIMIT_AUTHED_PER_MIN, 60);

// ── Middleware factories ───────────────────────────────────────────────────────

function makeRateLimitMiddleware(
  limiter: Ratelimit | null,
  limit: number,
  windowMs: number,
  keyFn: (req: Request) => string,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyFn(req);

    try {
      if (limiter) {
        const result = await limiter.limit(key);
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.reset);

        if (!result.success) {
          logger.warn('Rate limit exceeded (Redis)', { key, limit: result.limit });
          return next(AppError.rateLimited());
        }
      } else {
        // In-memory fallback
        const allowed = memoryRateLimit(key, limit, windowMs);
        if (!allowed) {
          logger.warn('Rate limit exceeded (memory)', { key, limit });
          return next(AppError.rateLimited());
        }
      }
      next();
    } catch (err) {
      // If Redis is down, fail open (allow request) — availability > strict limiting
      logger.error('Rate limiter error — failing open', { error: err, key });
      next();
    }
  };
}

// ── Exported limiters ─────────────────────────────────────────────────────────

/** 10 req/min per IP — for login/logout endpoints */
export const authRateLimit = makeRateLimitMiddleware(
  authLimiter,
  env.RATE_LIMIT_AUTH_PER_MIN,
  60_000,
  (req) => `auth:${req.ip ?? 'unknown'}`,
);

/** 100 req/min per IP — for public endpoints (contact form, portfolio) */
export const publicRateLimit = makeRateLimitMiddleware(
  publicLimiter,
  env.RATE_LIMIT_PUBLIC_PER_MIN,
  60_000,
  (req) => `pub:${req.ip ?? 'unknown'}`,
);

/** 1000 req/min per user ID — for authenticated admin endpoints */
export const authedRateLimit = makeRateLimitMiddleware(
  authedLimiter,
  env.RATE_LIMIT_AUTHED_PER_MIN,
  60_000,
  (req) => {
    // req.user is set by authenticate middleware
    const user = (req as Request & { user?: { id: string } }).user;
    return `authed:${user?.id ?? req.ip ?? 'unknown'}`;
  },
);
