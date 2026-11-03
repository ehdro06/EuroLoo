import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';

const fileMock = {
  delete: jest.fn(),
  exists: jest.fn(),
  getMetadata: jest.fn(),
};
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({ bucket: () => ({ file: () => fileMock }) })),
}));

// Imported after the mock so the service picks it up
import { ImagesService } from './images.service.js';

const BUCKET_URL = 'https://storage.googleapis.com/test-bucket/';
const OBJECT = '123e4567-e89b-12d3-a456-426614174000.jpg';

describe('ImagesService', () => {
  let prisma: { image: Record<string, jest.Mock>; toilet: Record<string, jest.Mock> };
  let usersService: { ensureUser: jest.Mock; findByClerkId: jest.Mock };
  let service: ImagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(fileMock).forEach((mock) => mock.mockReset());
    prisma = {
      image: { findUnique: jest.fn(), delete: jest.fn(), create: jest.fn() },
      toilet: { findUnique: jest.fn() },
    };
    usersService = { ensureUser: jest.fn().mockResolvedValue({ id: 5 }), findByClerkId: jest.fn() };
    service = new ImagesService(
      { get: () => 'test-bucket' } as unknown as ConfigService,
      prisma as unknown as PrismaService,
      usersService as unknown as UsersService,
    );
  });

  describe('deleteImage', () => {
    beforeEach(() => {
      prisma.image.findUnique.mockResolvedValue({ id: 1, url: BUCKET_URL + OBJECT, user: { clerkId: 'owner' } });
    });

    it('lets the uploader delete the photo and its stored file', async () => {
      await expect(service.deleteImage(1, 'owner')).resolves.toEqual({ success: true });
      expect(prisma.image.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(fileMock.delete).toHaveBeenCalledWith({ ignoreNotFound: true });
    });

    it('lets an admin delete anyone’s photo', async () => {
      usersService.findByClerkId.mockResolvedValue({ role: 'ADMIN' });
      await expect(service.deleteImage(1, 'admin')).resolves.toEqual({ success: true });
    });

    it('forbids other users', async () => {
      usersService.findByClerkId.mockResolvedValue({ role: 'USER' });
      await expect(service.deleteImage(1, 'stranger')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.image.delete).not.toHaveBeenCalled();
    });

    it('still succeeds if the stored file cannot be removed', async () => {
      fileMock.delete.mockRejectedValue(new Error('storage down'));
      await expect(service.deleteImage(1, 'owner')).resolves.toEqual({ success: true });
    });

    it('returns 404 for a missing photo', async () => {
      prisma.image.findUnique.mockResolvedValue(null);
      await expect(service.deleteImage(9, 'owner')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirmUpload', () => {
    it('rejects URLs outside our bucket', async () => {
      await expect(service.confirmUpload(1, 'https://evil.example/x.jpg', 'owner')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deletes and rejects an oversized upload', async () => {
      prisma.toilet.findUnique.mockResolvedValue({ id: 1 });
      fileMock.exists.mockResolvedValue([true]);
      fileMock.getMetadata.mockResolvedValue([{ size: String(6 * 1024 * 1024), contentType: 'image/jpeg' }]);

      await expect(service.confirmUpload(1, BUCKET_URL + OBJECT, 'owner')).rejects.toBeInstanceOf(BadRequestException);
      expect(fileMock.delete).toHaveBeenCalled();
      expect(prisma.image.create).not.toHaveBeenCalled();
    });

    it('saves a valid upload for the signed-in user', async () => {
      prisma.toilet.findUnique.mockResolvedValue({ id: 1 });
      fileMock.exists.mockResolvedValue([true]);
      fileMock.getMetadata.mockResolvedValue([{ size: '1000', contentType: 'image/png' }]);

      await service.confirmUpload(1, BUCKET_URL + OBJECT, 'owner');
      expect(prisma.image.create).toHaveBeenCalledWith({ data: { url: BUCKET_URL + OBJECT, toiletId: 1, userId: 5 } });
    });
  });
});
