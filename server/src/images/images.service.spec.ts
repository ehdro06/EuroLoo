import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';
import type { UploadQuotaService } from './upload-quota.service.js';

const fileMock = {
  delete: jest.fn(),
  exists: jest.fn(),
  getMetadata: jest.fn(),
  move: jest.fn(),
  getSignedUrl: jest.fn(),
};
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({ bucket: () => ({ file: () => fileMock }) })),
}));

// Imported after the mock so the service picks it up
import { ImagesService } from './images.service.js';

const BUCKET_URL = 'https://storage.googleapis.com/test-bucket/';
const OBJECT = '123e4567-e89b-12d3-a456-426614174000.jpg';
const PENDING = 'pending/' + OBJECT;

describe('ImagesService', () => {
  let prisma: {
    image: Record<string, jest.Mock>;
    toilet: Record<string, jest.Mock>;
    uploadGrant: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let usersService: { ensureUser: jest.Mock; findByClerkId: jest.Mock };
  let uploadQuota: { assertCanUpload: jest.Mock };
  let service: ImagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(fileMock).forEach((mock) => mock.mockReset());
    prisma = {
      image: { findUnique: jest.fn(), delete: jest.fn(), create: jest.fn().mockReturnValue('create-op') },
      toilet: { findUnique: jest.fn() },
      uploadGrant: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn().mockReturnValue('update-op') },
      $transaction: jest.fn().mockResolvedValue([{ id: 99 }]),
    };
    usersService = { ensureUser: jest.fn().mockResolvedValue({ id: 5 }), findByClerkId: jest.fn() };
    uploadQuota = { assertCanUpload: jest.fn().mockResolvedValue(undefined) };
    service = new ImagesService(
      { get: () => 'test-bucket' } as unknown as ConfigService,
      prisma as unknown as PrismaService,
      usersService as unknown as UsersService,
      uploadQuota as unknown as UploadQuotaService,
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

  describe('generatePresignedUrl', () => {
    it('signs a size range into a pending upload and records a grant', async () => {
      fileMock.getSignedUrl.mockResolvedValue(['https://signed.example/put']);

      const result = await service.generatePresignedUrl('image/jpeg', 'owner');

      const [options] = fileMock.getSignedUrl.mock.calls[0];
      expect(options.extensionHeaders).toEqual({ 'x-goog-content-length-range': `0,${5 * 1024 * 1024}` });
      expect(result.uploadHeaders).toEqual(options.extensionHeaders);
      expect(result.fileUrl).toMatch(new RegExp(`^${BUCKET_URL}pending/[0-9a-f-]{36}\\.jpg$`));
      expect(prisma.uploadGrant.create).toHaveBeenCalledWith({
        data: { objectName: result.fileUrl.slice(BUCKET_URL.length), userId: 5 },
      });
    });

    it('issues no URL when the quota is used up', async () => {
      uploadQuota.assertCanUpload.mockRejectedValue(new Error('quota'));
      await expect(service.generatePresignedUrl('image/png', 'owner')).rejects.toThrow('quota');
      expect(fileMock.getSignedUrl).not.toHaveBeenCalled();
      expect(prisma.uploadGrant.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmUpload', () => {
    const grant = { id: 7, objectName: PENDING, userId: 5, confirmedAt: null };

    beforeEach(() => {
      prisma.toilet.findUnique.mockResolvedValue({ id: 1 });
      prisma.uploadGrant.findUnique.mockResolvedValue(grant);
      fileMock.exists.mockResolvedValue([true]);
    });

    it('rejects URLs outside our bucket', async () => {
      await expect(service.confirmUpload(1, 'https://evil.example/x.jpg', 'owner')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects objects that are not pending uploads', async () => {
      await expect(service.confirmUpload(1, BUCKET_URL + OBJECT, 'owner')).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects someone else's upload", async () => {
      prisma.uploadGrant.findUnique.mockResolvedValue({ ...grant, userId: 6 });
      await expect(service.confirmUpload(1, BUCKET_URL + PENDING, 'owner')).rejects.toBeInstanceOf(BadRequestException);
      expect(fileMock.move).not.toHaveBeenCalled();
    });

    it('rejects an upload that was already confirmed', async () => {
      prisma.uploadGrant.findUnique.mockResolvedValue({ ...grant, confirmedAt: new Date() });
      await expect(service.confirmUpload(1, BUCKET_URL + PENDING, 'owner')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deletes and rejects an oversized upload', async () => {
      fileMock.getMetadata.mockResolvedValue([{ size: String(6 * 1024 * 1024), contentType: 'image/jpeg' }]);

      await expect(service.confirmUpload(1, BUCKET_URL + PENDING, 'owner')).rejects.toBeInstanceOf(BadRequestException);
      expect(fileMock.delete).toHaveBeenCalled();
      expect(fileMock.move).not.toHaveBeenCalled();
      expect(prisma.image.create).not.toHaveBeenCalled();
    });

    it('publishes a valid upload under its final name and marks the grant used', async () => {
      fileMock.getMetadata.mockResolvedValue([{ size: '1000', contentType: 'image/png' }]);

      await expect(service.confirmUpload(1, BUCKET_URL + PENDING, 'owner')).resolves.toEqual({ id: 99 });
      expect(fileMock.move).toHaveBeenCalledWith(OBJECT);
      expect(prisma.image.create).toHaveBeenCalledWith({ data: { url: BUCKET_URL + OBJECT, toiletId: 1, userId: 5 } });
      expect(prisma.uploadGrant.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { confirmedAt: expect.any(Date) } });
    });
  });
});
