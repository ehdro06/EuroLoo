import { Controller, Post, Body, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { ImagesService } from './images.service.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Post('presigned-url')
  @UseGuards(ClerkAuthGuard)
  async getPresignedUrl(@Body() body: { contentType: string, extension: string }) {
    if (!body.contentType || !body.extension) {
      throw new BadRequestException('Missing contentType or extension');
    }
    
    // Basic validation to prevent arbitrary uploads
    if (!body.contentType.startsWith('image/')) {
       throw new BadRequestException('Only images are allowed');
    }
    
    return this.imagesService.generatePresignedUrl(body.contentType, body.extension);
  }

  @Post('confirm')
  @UseGuards(ClerkAuthGuard)
  async confirmUpload(
    @Body() body: { toiletId: number; fileUrl: string },
    @Req() req: any,
  ) {
    if (!body.toiletId || !body.fileUrl) {
      throw new BadRequestException('Missing toiletId or fileUrl');
    }

    const userId = req.user.id;

    const bucketName = this.configService.get<string>('GCS_BUCKET_NAME') || 'euroloo-images-bucket';
    const expectedPrefix = `https://storage.googleapis.com/${bucketName}/`;
    
    if (!body.fileUrl.startsWith(expectedPrefix)) {
      throw new BadRequestException('Invalid file URL format or origin');
    }

    return this.prisma.image.create({
      data: {
        url: body.fileUrl,
        toiletId: body.toiletId,
        userId: userId,
      },
    });
  }
}
