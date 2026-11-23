import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { ALLOWED_IMAGE_TYPES, AllowedImageType } from './dto/presigned-url.dto.js';
import { sanitizeImage } from './sanitize-image.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
// Raw uploads land here and are never linked to. A bucket lifecycle rule deletes
// leftovers (abandoned uploads) after a day; see docs/DEPLOYMENT.md.
const PENDING_PREFIX = 'pending/';
// Cleaned, public photos
const PHOTOS_PREFIX = 'photos/';
// Upload IDs we hand out: pending/<uuid>.<ext>
const UPLOAD_ID_PATTERN = /^pending\/([0-9a-f-]{36})\.(jpg|png|webp)$/;

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);
  private storage: Storage;
  private bucketName: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {
    // Application Default Credentials: gcloud auth locally, the service account on Cloud Run
    this.storage = new Storage();
    this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME') || 'euroloo-images-bucket';
  }

  private get publicUrlPrefix() {
    return `https://storage.googleapis.com/${this.bucketName}/`;
  }

  // The browser uploads the raw file to a pending location; it only becomes a
  // public photo after confirmUpload has stripped its metadata.
  async generatePresignedUrl(contentType: AllowedImageType): Promise<{ uploadUrl: string; uploadId: string }> {
    const uploadId = `${PENDING_PREFIX}${crypto.randomUUID()}.${ALLOWED_IMAGE_TYPES[contentType]}`;
    try {
      const [uploadUrl] = await this.storage.bucket(this.bucketName).file(uploadId).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + UPLOAD_URL_TTL_MS,
        contentType,
      });
      return { uploadUrl, uploadId };
    } catch (error) {
      this.logger.error('Error generating presigned URL', error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  // Turns a pending upload into a public photo: validates it, re-encodes it without
  // any metadata (GPS position, camera details), stores the clean copy and deletes
  // the raw upload. This runs on the server so it can't be skipped by a modified client.
  async confirmUpload(toiletId: number, uploadId: string, clerkId: string) {
    const match = UPLOAD_ID_PATTERN.exec(uploadId);
    if (!match) throw new BadRequestException('Invalid upload ID');

    const toilet = await this.prisma.toilet.findUnique({ where: { id: toiletId }, select: { id: true } });
    if (!toilet) throw new NotFoundException('Toilet not found');

    const bucket = this.storage.bucket(this.bucketName);
    const pending = bucket.file(uploadId);
    await this.assertValidUpload(pending);

    let cleaned: Buffer;
    try {
      const [raw] = await pending.download();
      cleaned = await sanitizeImage(raw);
    } catch (error) {
      await pending.delete({ ignoreNotFound: true });
      this.logger.warn(`Rejected upload ${uploadId}: ${error instanceof Error ? error.message : error}`);
      throw new BadRequestException('The file is not a valid image');
    }

    const photoName = `${PHOTOS_PREFIX}${match[1]}.jpg`;
    await bucket.file(photoName).save(cleaned, {
      contentType: 'image/jpeg',
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    await pending.delete({ ignoreNotFound: true });

    const user = await this.usersService.ensureUser(clerkId);
    return this.prisma.image.create({
      data: { url: `${this.publicUrlPrefix}${photoName}`, toiletId, userId: user.id },
    });
  }

  // The uploader or an admin can delete a photo
  async deleteImage(imageId: number, clerkId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { id: true, url: true, user: { select: { clerkId: true } } },
    });
    if (!image) throw new NotFoundException('Image not found');

    if (image.user?.clerkId !== clerkId) {
      const requester = await this.usersService.findByClerkId(clerkId);
      if (requester?.role !== 'ADMIN') {
        throw new ForbiddenException('You can only delete your own photos');
      }
    }

    await this.prisma.image.delete({ where: { id: imageId } });

    // The database row is the source of truth; a leftover file is harmless, so don't fail the request
    if (image.url.startsWith(this.publicUrlPrefix)) {
      const objectName = image.url.slice(this.publicUrlPrefix.length);
      try {
        await this.storage.bucket(this.bucketName).file(objectName).delete({ ignoreNotFound: true });
      } catch (error) {
        this.logger.warn(`Failed to delete ${objectName} from storage: ${error instanceof Error ? error.message : error}`);
      }
    }

    return { success: true };
  }

  // Best-effort removal of stored files, e.g. after an account is deleted
  async deleteStoredFiles(urls: string[]): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    await Promise.all(
      urls
        .filter((url) => url.startsWith(this.publicUrlPrefix))
        .map(async (url) => {
          const objectName = url.slice(this.publicUrlPrefix.length);
          try {
            await bucket.file(objectName).delete({ ignoreNotFound: true });
          } catch (error) {
            this.logger.warn(`Failed to delete ${objectName}: ${error instanceof Error ? error.message : error}`);
          }
        }),
    );
  }

  // Signed URLs can't cap the upload size, so check what actually landed in the bucket
  private async assertValidUpload(file: ReturnType<ReturnType<Storage['bucket']>['file']>) {
    const [exists] = await file.exists();
    if (!exists) throw new BadRequestException('Uploaded file not found');

    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    const isAllowedType = typeof metadata.contentType === 'string' && metadata.contentType in ALLOWED_IMAGE_TYPES;
    if (size > MAX_IMAGE_BYTES || !isAllowedType) {
      await file.delete({ ignoreNotFound: true });
      throw new BadRequestException(`Images must be JPEG, PNG or WebP and at most ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
    }
  }
}
