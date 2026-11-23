import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';

const fileMock = {
  delete: jest.fn(),
  exists: jest.fn(),
  getMetadata: jest.fn(),
  download: jest.fn(),
  save: jest.fn(),
};
const fileNames: string[] = [];
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: () => ({
      file: (name: string) => {
        fileNames.push(name);
        return fileMock;
      },
    }),
  })),
}));

// Imported after the mock so the service picks it up
import { ImagesService } from './images.service.js';
import sharp from 'sharp';
import exifr from 'exifr';

// A real JPEG carrying GPS coordinates, a camera make and an author, like a phone photo
const photoWithGps = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: '#c86' } })
    .withExif({
      IFD0: { Make: 'TestCam', Artist: 'Jane Doe' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '52/1 31/1 12/1', GPSLongitudeRef: 'E', GPSLongitude: '13/1 24/1 18/1' },
    })
    .jpeg()
    .toBuffer();

const UPLOAD_ID = 'pending/123e4567-e89b-12d3-a456-426614174000.jpg';

const BUCKET_URL = 'https://storage.googleapis.com/test-bucket/';
const OBJECT = '123e4567-e89b-12d3-a456-426614174000.jpg';

describe('ImagesService', () => {
  let prisma: { image: Record<string, jest.Mock>; toilet: Record<string, jest.Mock> };
  let usersService: { ensureUser: jest.Mock; findByClerkId: jest.Mock };
  let service: ImagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(fileMock).forEach((mock) => mock.mockReset());
    fileNames.length = 0;
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
    it('rejects upload IDs outside the pending folder', async () => {
      for (const bad of ['photos/x.jpg', '123e4567-e89b-12d3-a456-426614174000.jpg', 'pending/../secret.jpg']) {
        await expect(service.confirmUpload(1, bad, 'owner')).rejects.toBeInstanceOf(BadRequestException);
      }
    });

    it('deletes and rejects an oversized upload', async () => {
      prisma.toilet.findUnique.mockResolvedValue({ id: 1 });
      fileMock.exists.mockResolvedValue([true]);
      fileMock.getMetadata.mockResolvedValue([{ size: String(6 * 1024 * 1024), contentType: 'image/jpeg' }]);

      await expect(service.confirmUpload(1, UPLOAD_ID, 'owner')).rejects.toBeInstanceOf(BadRequestException);
      expect(fileMock.delete).toHaveBeenCalled();
      expect(prisma.image.create).not.toHaveBeenCalled();
    });

    it('rejects a file that is not really an image', async () => {
      prisma.toilet.findUnique.mockResolvedValue({ id: 1 });
      fileMock.exists.mockResolvedValue([true]);
      fileMock.getMetadata.mockResolvedValue([{ size: '20', contentType: 'image/jpeg' }]);
      fileMock.download.mockResolvedValue([Buffer.from('<html>not a photo</html>')]);

      await expect(service.confirmUpload(1, UPLOAD_ID, 'owner')).rejects.toBeInstanceOf(BadRequestException);
      expect(fileMock.delete).toHaveBeenCalled();
      expect(fileMock.save).not.toHaveBeenCalled();
    });

    it('publishes a copy without GPS or any other metadata and removes the raw upload', async () => {
      const original = await photoWithGps();
      // Sanity check: the input really carries a location
      expect(await exifr.gps(original)).toMatchObject({ latitude: expect.any(Number), longitude: expect.any(Number) });

      prisma.toilet.findUnique.mockResolvedValue({ id: 1 });
      fileMock.exists.mockResolvedValue([true]);
      fileMock.getMetadata.mockResolvedValue([{ size: String(original.length), contentType: 'image/jpeg' }]);
      fileMock.download.mockResolvedValue([original]);

      await service.confirmUpload(1, UPLOAD_ID, 'owner');

      const [savedBuffer, saveOptions] = fileMock.save.mock.calls[0] as [Buffer, { contentType: string }];
      expect(saveOptions.contentType).toBe('image/jpeg');
      expect(await exifr.parse(savedBuffer, true)).toBeUndefined();
      expect(await exifr.gps(savedBuffer)).toBeUndefined();
      expect((await sharp(savedBuffer).metadata()).exif).toBeUndefined();

      // Stored under photos/, the pending file deleted, and only the clean URL saved
      expect(fileNames).toContain('photos/123e4567-e89b-12d3-a456-426614174000.jpg');
      expect(fileMock.delete).toHaveBeenCalled();
      expect(prisma.image.create).toHaveBeenCalledWith({
        data: { url: BUCKET_URL + 'photos/123e4567-e89b-12d3-a456-426614174000.jpg', toiletId: 1, userId: 5 },
      });
    });
  });
});
