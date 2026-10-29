import { ExecutionContext, HttpException } from '@nestjs/common';
import { SimpleRateLimitGuard } from './simple-rate-limit.guard.js';

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

describe('SimpleRateLimitGuard', () => {
  const guard = new SimpleRateLimitGuard();
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

  it('blocks requests over the limit with 429', () => {
    guard.canActivate(contextFor(request()));
    guard.canActivate(contextFor(request()));

    expect(() => guard.canActivate(contextFor(request()))).toThrow(HttpException);
  });

  it('ignores a spoofed X-Forwarded-For header', () => {
    guard.canActivate(contextFor(request({ headers: { 'x-forwarded-for': '1.1.1.1' } })));
    guard.canActivate(contextFor(request({ headers: { 'x-forwarded-for': '2.2.2.2' } })));

    expect(() =>
      guard.canActivate(contextFor(request({ headers: { 'x-forwarded-for': '3.3.3.3' } }))),
    ).toThrow(HttpException);
  });

  it('counts by route pattern, so changing the ID does not reset the limit', () => {
    guard.canActivate(contextFor(request({ path: '/toilets/1' })));
    guard.canActivate(contextFor(request({ path: '/toilets/2' })));

    expect(() => guard.canActivate(contextFor(request({ path: '/toilets/3' })))).toThrow(HttpException);
  });

  it('limits signed-in users individually, even behind a shared IP', () => {
    guard.canActivate(contextFor(request({ user: { id: 'alice' } })));
    guard.canActivate(contextFor(request({ user: { id: 'alice' } })));

    expect(guard.canActivate(contextFor(request({ user: { id: 'bob' } })))).toBe(true);
  });
});
