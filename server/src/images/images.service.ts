import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ImagesService {
  private storage: Storage;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    // Using default credentials which works well locally (if gcloud auth is set) 
    // and seamlessly on Google Cloud Run.
    this.storage = new Storage();
    this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME') || 'euroloo-images-bucket';
  }

  async generatePresignedUrl(contentType: string, extension: string): Promise<{ uploadUrl: string; fileUrl: string }> {
    try {
      const fileName = `${crypto.randomUUID()}.${extension.replace(/^\./, '')}`;
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
      });

      return {
        uploadUrl: url,
        fileUrl: `https://storage.googleapis.com/${this.bucketName}/${fileName}`,
      };
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }
}
