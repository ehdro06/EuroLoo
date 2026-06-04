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
    const ip = this.getClientIp(request);
    const method = request.method || 'UNKNOWN';
    const route = request.originalUrl || request.url || 'unknown-route';
    return `${ip}:${method}:${route}`;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() || request.ip || 'unknown-ip';
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0] || request.ip || 'unknown-ip';
    }
    return request.ip || 'unknown-ip';
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
