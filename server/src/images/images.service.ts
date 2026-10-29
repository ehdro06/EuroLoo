import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { ALLOWED_IMAGE_TYPES, AllowedImageType } from './dto/presigned-url.dto.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
// Object names we hand out: <uuid>.<ext>
const OBJECT_NAME_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

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

  async generatePresignedUrl(contentType: AllowedImageType): Promise<{ uploadUrl: string; fileUrl: string }> {
    const fileName = `${crypto.randomUUID()}.${ALLOWED_IMAGE_TYPES[contentType]}`;
    try {
      const [uploadUrl] = await this.storage.bucket(this.bucketName).file(fileName).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + UPLOAD_URL_TTL_MS,
        contentType,
      });
      return { uploadUrl, fileUrl: `${this.publicUrlPrefix}${fileName}` };
    } catch (error) {
      this.logger.error('Error generating presigned URL', error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  async confirmUpload(toiletId: number, fileUrl: string, clerkId: string) {
    if (!fileUrl.startsWith(this.publicUrlPrefix)) {
      throw new BadRequestException('Invalid file URL');
    }
    const objectName = fileUrl.slice(this.publicUrlPrefix.length);
    if (!OBJECT_NAME_PATTERN.test(objectName)) {
      throw new BadRequestException('Invalid file URL');
    }

    const toilet = await this.prisma.toilet.findUnique({ where: { id: toiletId }, select: { id: true } });
    if (!toilet) throw new NotFoundException('Toilet not found');

    await this.assertValidUpload(objectName);

    const user = await this.usersService.ensureUser(clerkId);
    return this.prisma.image.create({
      data: { url: fileUrl, toiletId, userId: user.id },
    });
  }

  // Signed URLs can't cap the upload size, so check what actually landed in the bucket
  private async assertValidUpload(objectName: string) {
    const file = this.storage.bucket(this.bucketName).file(objectName);
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
