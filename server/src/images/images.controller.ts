import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ImagesService } from './images.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserId } from '../auth/current-user.decorator';

@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly prisma: PrismaService,
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
    @CurrentUserId() userId: number,
  ) {
    if (!body.toiletId || !body.fileUrl) {
      throw new BadRequestException('Missing toiletId or fileUrl');
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
