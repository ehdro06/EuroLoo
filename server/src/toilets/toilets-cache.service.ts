import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RedisService } from '../redis/redis.service.js';

// Short enough that stale results (e.g. on another instance without Redis) don't linger
export const TOILETS_CACHE_TTL_MS = 5 * 60 * 1000;

// Caches map query results. Uses Redis when available (shared by all Cloud Run
// instances), otherwise this instance's memory.
//
// Invalidation bumps a generation number that is part of every Redis key, instead
// of deleting keys: one atomic command, and it never touches other apps' keys on a
// shared Redis. Old entries simply expire.
@Injectable()
export class ToiletsCacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly memory: Cache,
    private readonly redis: RedisService,
  ) {}

  private get generationKey() {
    return `${this.redis.keyPrefix}toilets:generation`;
  }

  private async redisKey(key: string): Promise<string | null> {
    const generation = await this.redis.run((client) => client.get(this.generationKey));
    if (generation === null && !this.redis.isAvailable) return null;
    return `${this.redis.keyPrefix}toilets:${generation ?? '0'}:${key}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const redisKey = await this.redisKey(key);
    if (redisKey) {
      const value = await this.redis.run((client) => client.get(redisKey));
      if (value !== null) return JSON.parse(value) as T;
      if (this.redis.isAvailable) return undefined;
    }
    return (await this.memory.get<T>(key)) ?? undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    const redisKey = await this.redisKey(key);
    if (redisKey) {
      const stored = await this.redis.run((client) =>
        client.set(redisKey, JSON.stringify(value), { expiration: { type: 'PX', value: TOILETS_CACHE_TTL_MS } }),
      );
      if (stored !== null) return;
    }
    await this.memory.set(key, value, TOILETS_CACHE_TTL_MS);
  }

  // Call after any write that changes what the map shows
  async invalidate(): Promise<void> {
    await this.redis.run((client) => client.incr(this.generationKey));
    // Always clear local memory too, in case it served while Redis was down
    await this.memory.clear();
  }
}
