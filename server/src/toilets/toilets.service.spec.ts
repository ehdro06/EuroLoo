import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AUTO_HIDE_REPORT_MARGIN,
  AUTO_VERIFY_THRESHOLD,
  ToiletsService,
  getDistanceInMeters,
} from './toilets.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';
import type { CreateToiletDto } from './dto/create-toilet.dto.js';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, { code, clientVersion: '6.0.0' });

function createPrismaMock() {
  const prisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    toilet: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    vote: { create: jest.fn(), deleteMany: jest.fn() },
    // Interactive transactions run against the same mock
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg as Promise<unknown>[]),
  );
  return prisma;
}

describe('ToiletsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let usersService: { ensureUser: jest.Mock };
  let service: ToiletsService;

  // Berlin Alexanderplatz; 0.0001° latitude ≈ 11m
  const base: CreateToiletDto = { lat: 52.5219, lng: 13.4132, userLat: 52.5219, userLng: 13.4132 };

  beforeEach(() => {
    prisma = createPrismaMock();
    usersService = { ensureUser: jest.fn().mockResolvedValue({ id: 7, clerkId: 'user_1' }) };
    service = new ToiletsService(prisma as unknown as PrismaService, usersService as unknown as UsersService);
  });

  describe('getDistanceInMeters', () => {
    it('returns 0 for identical points', () => {
      expect(getDistanceInMeters(52.52, 13.405, 52.52, 13.405)).toBe(0);
    });

    it('matches the known Berlin–Paris distance within 1%', () => {
      const distance = getDistanceInMeters(52.52, 13.405, 48.8566, 2.3522);
      expect(distance).toBeGreaterThan(874_000);
      expect(distance).toBeLessThan(882_000);
    });
  });

  describe('createToilet', () => {
    it('rejects submissions from more than 50m away', async () => {
      const dto = { ...base, userLat: base.lat + 0.001 }; // ~111m away

      await expect(service.createToilet(dto, 'user_1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.toilet.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate within 20m of an existing toilet', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);

      await expect(service.createToilet(base, 'user_1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.toilet.create).not.toHaveBeenCalled();
    });

    it('creates the toilet and its PostGIS location in one transaction', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.toilet.create.mockResolvedValue({ id: 42 });

      const result = await service.createToilet({ ...base, name: 'Station WC' }, 'user_1');

      expect(result).toEqual({ id: 42 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.toilet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Station WC',
          lat: base.lat,
          lon: base.lng,
          isUserCreated: true,
          contributorId: 7,
          externalId: expect.stringMatching(/^user-/),
        }),
      });
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('voting', () => {
    it(`hides a toilet once reports exceed verifications by ${AUTO_HIDE_REPORT_MARGIN}`, async () => {
      prisma.toilet.update
        .mockResolvedValueOnce({ id: 1, reportCount: AUTO_HIDE_REPORT_MARGIN, verifyCount: 0 })
        .mockResolvedValueOnce({ id: 1, isHidden: true });

      const result = await service.reportToilet(1, 'user_1');

      expect(prisma.vote.create).toHaveBeenCalledWith({ data: { type: 'REPORT', userId: 7, toiletId: 1 } });
      expect(prisma.toilet.update).toHaveBeenLastCalledWith({ where: { id: 1 }, data: { isHidden: true } });
      expect(result).toEqual({ id: 1, isHidden: true });
    });

    it('does not hide a toilet that has enough verifications', async () => {
      prisma.toilet.update.mockResolvedValueOnce({ id: 1, reportCount: 3, verifyCount: 2 });

      await service.reportToilet(1, 'user_1');

      expect(prisma.toilet.update).toHaveBeenCalledTimes(1);
    });

    it(`verifies a toilet after ${AUTO_VERIFY_THRESHOLD} confirmations`, async () => {
      prisma.toilet.update
        .mockResolvedValueOnce({ id: 1, verifyCount: AUTO_VERIFY_THRESHOLD, isVerified: false })
        .mockResolvedValueOnce({ id: 1, isVerified: true });

      await service.verifyToilet(1, 'user_1');

      expect(prisma.toilet.update).toHaveBeenLastCalledWith({ where: { id: 1 }, data: { isVerified: true } });
    });

    it('returns 409 when the user already voted', async () => {
      prisma.vote.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.verifyToilet(1, 'user_1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns 404 when the toilet does not exist', async () => {
      prisma.vote.create.mockRejectedValue(prismaError('P2003'));

      await expect(service.reportToilet(999, 'user_1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('admin', () => {
    it('removes votes before deleting a toilet', async () => {
      await service.deleteToilet(1);

      expect(prisma.vote.deleteMany).toHaveBeenCalledWith({ where: { toiletId: 1 } });
      expect(prisma.toilet.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('returns 404 when restoring a missing toilet', async () => {
      prisma.toilet.update.mockRejectedValue(prismaError('P2025'));

      await expect(service.restoreToilet(1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
