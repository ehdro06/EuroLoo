import type { Cache } from 'cache-manager';
import type { RedisService } from '../redis/redis.service.js';
import { ToiletsCacheService } from './toilets-cache.service.js';

function memoryCache() {
  const data = new Map<string, unknown>();
  return {
    get: jest.fn(async (key: string) => data.get(key)),
    set: jest.fn(async (key: string, value: unknown) => void data.set(key, value)),
    clear: jest.fn(async () => data.clear()),
  };
}

function fakeRedis(available = true) {
  const data = new Map<string, string>();
  const client = {
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: string) => (data.set(key, value), 'OK'),
    incr: async (key: string) => {
      const next = Number(data.get(key) ?? '0') + 1;
      data.set(key, String(next));
      return next;
    },
  };
  const service = {
    keyPrefix: 'euroloo:',
    isAvailable: available,
    run: async (command: (c: typeof client) => Promise<unknown>) => (available ? command(client) : null),
  } as unknown as RedisService;
  return { service, data };
}

describe('ToiletsCacheService', () => {
  it('stores results in Redis under a generation-scoped key', async () => {
    const memory = memoryCache();
    const { service, data } = fakeRedis();
    const cache = new ToiletsCacheService(memory as unknown as Cache, service);

    await cache.set('toilets_52.5_13.4_5000', [{ id: 1 }]);

    expect(data.get('euroloo:toilets:0:toilets_52.5_13.4_5000')).toBe('[{"id":1}]');
    expect(memory.set).not.toHaveBeenCalled();
    await expect(cache.get('toilets_52.5_13.4_5000')).resolves.toEqual([{ id: 1 }]);
  });

  it('invalidates by bumping the generation, without deleting other keys', async () => {
    const memory = memoryCache();
    const { service, data } = fakeRedis();
    data.set('viral:other-app-key', 'keep me');
    const cache = new ToiletsCacheService(memory as unknown as Cache, service);

    await cache.set('area', [{ id: 1 }]);
    await cache.invalidate();

    await expect(cache.get('area')).resolves.toBeUndefined();
    expect(data.get('euroloo:toilets:generation')).toBe('1');
    expect(data.get('viral:other-app-key')).toBe('keep me');
  });

  it('falls back to memory when Redis is unavailable', async () => {
    const memory = memoryCache();
    const { service } = fakeRedis(false);
    const cache = new ToiletsCacheService(memory as unknown as Cache, service);

    await cache.set('area', [{ id: 2 }]);
    await expect(cache.get('area')).resolves.toEqual([{ id: 2 }]);
    expect(memory.set).toHaveBeenCalled();

    await cache.invalidate();
    expect(memory.clear).toHaveBeenCalled();
  });
});
