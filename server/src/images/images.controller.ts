import { Controller, Post, Body, UseGuards, Req, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { ImagesService } from './images.service.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { SimpleRateLimitGuard } from '../common/guards/simple-rate-limit.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { PresignedUrlDto } from './dto/presigned-url.dto.js';
import { ConfirmUploadDto } from './dto/confirm-upload.dto.js';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('presigned-url')
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  getPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.imagesService.generatePresignedUrl(dto.contentType);
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  deleteImage(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.imagesService.deleteImage(id, req.user.id);
  }

  @Post('confirm')
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  confirmUpload(@Body() dto: ConfirmUploadDto, @Req() req: AuthenticatedRequest) {
    return this.imagesService.confirmUpload(dto.toiletId, dto.fileUrl, req.user.id);
  }
}
