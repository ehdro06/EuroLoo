import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import { startOfUtcDay, UploadQuotaService } from './upload-quota.service.js';

const NOW = new Date('2026-11-24T15:00:00Z');
const OLD_ACCOUNT = new Date('2026-09-01T00:00:00Z');
const NEW_ACCOUNT = new Date('2026-11-20T00:00:00Z');

describe('UploadQuotaService', () => {
  let counts: { global: number; user: number; livePhotos: number };
  let prisma: { uploadGrant: { count: jest.Mock }; image: { count: jest.Mock } };
  let service: UploadQuotaService;

  const user = (overrides: Partial<{ id: number; role: 'USER' | 'ADMIN'; createdAt: Date }> = {}) => ({
    id: 1,
    role: 'USER' as const,
    createdAt: NEW_ACCOUNT,
    ...overrides,
  });

  beforeEach(() => {
    counts = { global: 0, user: 0, livePhotos: 0 };
    prisma = {
      uploadGrant: {
        count: jest.fn(({ where }) => Promise.resolve(where.userId ? counts.user : counts.global)),
      },
      image: { count: jest.fn(() => Promise.resolve(counts.livePhotos)) },
    };
    service = new UploadQuotaService(prisma as unknown as PrismaService, { get: () => undefined } as unknown as ConfigService);
  });

  it('counts from the start of the UTC day', async () => {
    await service.assertCanUpload(user(), NOW);
    expect(prisma.uploadGrant.count).toHaveBeenCalledWith({ where: { createdAt: { gte: startOfUtcDay(NOW) } } });
    expect(startOfUtcDay(NOW).toISOString()).toBe('2026-11-24T00:00:00.000Z');
  });

  it('allows a new user under 50 a day and blocks the 51st', async () => {
    counts.user = 49;
    await expect(service.assertCanUpload(user(), NOW)).resolves.toBeUndefined();
    counts.user = 50;
    await expect(service.assertCanUpload(user(), NOW)).rejects.toBeInstanceOf(HttpException);
  });

  it('gives a trusted contributor 200 a day', async () => {
    counts.user = 150;
    counts.livePhotos = 10;
    await expect(service.assertCanUpload(user({ createdAt: OLD_ACCOUNT }), NOW)).resolves.toBeUndefined();
    counts.user = 200;
    await expect(service.assertCanUpload(user({ createdAt: OLD_ACCOUNT }), NOW)).rejects.toBeInstanceOf(HttpException);
  });

  it('needs both account age and live photos to be trusted', async () => {
    counts.livePhotos = 50;
    await expect(service.isTrusted(user({ createdAt: NEW_ACCOUNT }), NOW)).resolves.toBe(false);
    counts.livePhotos = 9;
    await expect(service.isTrusted(user({ createdAt: OLD_ACCOUNT }), NOW)).resolves.toBe(false);
    counts.livePhotos = 10;
    await expect(service.isTrusted(user({ createdAt: OLD_ACCOUNT }), NOW)).resolves.toBe(true);
  });

  it('stops everyone, admins included, at the global cap', async () => {
    counts.global = 500;
    await expect(service.assertCanUpload(user(), NOW)).rejects.toBeInstanceOf(HttpException);
    await expect(service.assertCanUpload(user({ role: 'ADMIN' }), NOW)).rejects.toBeInstanceOf(HttpException);
  });

  it('has no per-user cap for admins', async () => {
    counts.user = 10_000;
    await expect(service.assertCanUpload(user({ role: 'ADMIN' }), NOW)).resolves.toBeUndefined();
  });

  it('answers 429 with the seconds until midnight UTC', async () => {
    counts.global = 500;
    const error = await service.assertCanUpload(user(), NOW).catch((e: HttpException) => e);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toMatchObject({ retryAfter: 9 * 60 * 60 });
  });

  it('reads limits from the environment', () => {
    const configured = new UploadQuotaService(
      prisma as unknown as PrismaService,
      { get: (key: string) => ({ UPLOADS_GLOBAL_PER_DAY: '1000' })[key] } as unknown as ConfigService,
    );
    expect(configured.limits).toEqual({ globalPerDay: 1000, userPerDay: 50, trustedPerDay: 200 });
  });
});
