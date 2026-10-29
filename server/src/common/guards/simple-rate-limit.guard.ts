import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';

type RateEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class SimpleRateLimitGuard implements CanActivate {
  private static readonly store = new Map<string, RateEntry>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const ttlMs = this.getRateLimitTtlMs();
    const limit = this.getRateLimitLimit();
    const key = this.buildKey(request);

    this.pruneExpired(now);

    const existing = SimpleRateLimitGuard.store.get(key);
    if (!existing || now >= existing.resetAt) {
      SimpleRateLimitGuard.store.set(key, { count: 1, resetAt: now + ttlMs });
      return true;
    }

    if (existing.count >= limit) {
      throw new HttpException('Rate limit exceeded. Please retry shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    SimpleRateLimitGuard.store.set(key, existing);
    return true;
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
