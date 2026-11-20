import { ExecutionContext, HttpException } from '@nestjs/common';
import { SimpleRateLimitGuard } from './simple-rate-limit.guard.js';
import type { RedisService } from '../../redis/redis.service.js';

type FakeRequest = {
  ip?: string;
  method: string;
  path: string;
  route?: { path: string };
  headers: Record<string, string>;
  user?: { id: string };
};

const contextFor = (request: FakeRequest) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

// Redis disabled: run() returns null, so the guard uses memory
const noRedis = { keyPrefix: 'euroloo:', isAvailable: false, run: async () => null } as unknown as RedisService;

// A tiny in-process stand-in for Redis INCR/PEXPIRE
function fakeRedis() {
  const counts = new Map<string, number>();
  const client = {
    incr: async (key: string) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key)!;
    },
    pExpire: jest.fn(async () => 1),
  };
  const service = {
    keyPrefix: 'euroloo:',
    isAvailable: true,
    run: (command: (c: typeof client) => Promise<unknown>) => command(client),
  } as unknown as RedisService;
  return { service, client, counts };
}

describe('SimpleRateLimitGuard', () => {
  const guard = new SimpleRateLimitGuard(noRedis);
  let counter = 0;

  beforeAll(() => {
    process.env.RATE_LIMIT_LIMIT = '2';
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_LIMIT;
  });

  // Unique route per test so the shared in-memory store doesn't leak between tests
  const request = (overrides: Partial<FakeRequest> = {}): FakeRequest => ({
    ip: '203.0.113.1',
    method: 'POST',
    path: `/test-${counter}`,
    route: { path: `/test-${counter}/:id` },
    headers: {},
    ...overrides,
  });

  beforeEach(() => {
    counter += 1;
  });

  it('blocks requests over the limit with 429', async () => {
    await guard.canActivate(contextFor(request()));
    await guard.canActivate(contextFor(request()));

    await expect(guard.canActivate(contextFor(request()))).rejects.toThrow(HttpException);
  });

  it('ignores a spoofed X-Forwarded-For header', async () => {
    await guard.canActivate(contextFor(request({ headers: { 'x-forwarded-for': '1.1.1.1' } })));
    await guard.canActivate(contextFor(request({ headers: { 'x-forwarded-for': '2.2.2.2' } })));

    await expect(
      guard.canActivate(contextFor(request({ headers: { 'x-forwarded-for': '3.3.3.3' } }))),
    ).rejects.toThrow(HttpException);
  });

  it('counts by route pattern, so changing the ID does not reset the limit', async () => {
    await guard.canActivate(contextFor(request({ path: '/toilets/1' })));
    await guard.canActivate(contextFor(request({ path: '/toilets/2' })));

    await expect(guard.canActivate(contextFor(request({ path: '/toilets/3' })))).rejects.toThrow(HttpException);
  });

  it('limits signed-in users individually, even behind a shared IP', async () => {
    await guard.canActivate(contextFor(request({ user: { id: 'alice' } })));
    await guard.canActivate(contextFor(request({ user: { id: 'alice' } })));

    await expect(guard.canActivate(contextFor(request({ user: { id: 'bob' } })))).resolves.toBe(true);
  });

  describe('with Redis', () => {
    it('counts in Redis under the app prefix and sets the window on the first request', async () => {
      const { service, client, counts } = fakeRedis();
      const redisGuard = new SimpleRateLimitGuard(service);

      await redisGuard.canActivate(contextFor(request({ user: { id: 'carol' } })));
      await redisGuard.canActivate(contextFor(request({ user: { id: 'carol' } })));
      await expect(redisGuard.canActivate(contextFor(request({ user: { id: 'carol' } })))).rejects.toThrow(
        HttpException,
      );

      const [key] = [...counts.keys()];
      expect(key).toMatch(/^euroloo:ratelimit:user:carol:POST:/);
      expect(client.pExpire).toHaveBeenCalledTimes(1);
    });
  });
});
