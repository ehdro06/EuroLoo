import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service.js';

type RateEntry = {
  count: number;
  resetAt: number;
};

// Fixed-window rate limit. Counts live in Redis when available, so the limit holds
// across all Cloud Run instances; otherwise in this instance's memory.
@Injectable()
export class SimpleRateLimitGuard implements CanActivate {
  private static readonly store = new Map<string, RateEntry>();

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ttlMs = this.getRateLimitTtlMs();
    const limit = this.getRateLimitLimit();
    const key = this.buildKey(request);

    const count = (await this.countInRedis(key, ttlMs)) ?? this.countInMemory(key, ttlMs);
    if (count > limit) {
      throw new HttpException('Rate limit exceeded. Please retry shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  // Returns this request's position in the current window, or null without Redis
  private countInRedis(key: string, ttlMs: number): Promise<number | null> {
    const redisKey = `${this.redis.keyPrefix}ratelimit:${key}`;
    return this.redis.run(async (client) => {
      const count = await client.incr(redisKey);
      // The first request of a window starts its timer
      if (count === 1) await client.pExpire(redisKey, ttlMs);
      return count;
    });
  }

  private countInMemory(key: string, ttlMs: number): number {
    const now = Date.now();
    this.pruneExpired(now);

    const existing = SimpleRateLimitGuard.store.get(key);
    if (!existing || now >= existing.resetAt) {
      SimpleRateLimitGuard.store.set(key, { count: 1, resetAt: now + ttlMs });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }

  private buildKey(request: Request): string {
    // Prefer the authenticated user (set by ClerkAuthGuard, which runs first).
    // Otherwise fall back to the client IP. `request.ip` honours the `trust proxy`
    // setting in main.ts, so a spoofed X-Forwarded-For header is ignored.
    const user = (request as Request & { user?: { id?: string } }).user;
    const client = user?.id ? `user:${user.id}` : `ip:${request.ip ?? 'unknown'}`;
    // Use the route pattern (e.g. /api/toilets/:id/report) so changing the ID
    // in the URL doesn't reset the limit.
    const route = (request.route as { path?: string } | undefined)?.path ?? request.path;
    return `${client}:${request.method}:${route}`;
  }

  private getRateLimitTtlMs(): number {
    const raw = Number(process.env.RATE_LIMIT_TTL_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : 60000;
  }

  private getRateLimitLimit(): number {
    const raw = Number(process.env.RATE_LIMIT_LIMIT);
    return Number.isFinite(raw) && raw > 0 ? raw : 60;
  }

  private pruneExpired(now: number): void {
    if (SimpleRateLimitGuard.store.size < 1000) return;
    for (const [key, value] of SimpleRateLimitGuard.store.entries()) {
      if (value.resetAt <= now) {
        SimpleRateLimitGuard.store.delete(key);
      }
    }
  }
}
