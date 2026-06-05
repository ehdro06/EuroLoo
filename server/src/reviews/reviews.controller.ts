import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { OptionalClerkAuthGuard } from '../auth/optional-clerk-auth.guard.js';
import { SimpleRateLimitGuard } from '../common/guards/simple-rate-limit.guard.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(OptionalClerkAuthGuard, SimpleRateLimitGuard)
  create(@Body() createReviewDto: CreateReviewDto, @Req() req: any) {
    return this.reviewsService.create(createReviewDto, req.user?.id);
  }

  @Get()
  findAll() {
    return this.reviewsService.findAll();
  }

  @Get('toilet/:externalId')
  findAllByToilet(@Param('externalId') externalId: string) {
    return this.reviewsService.findAllByToilet(externalId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(SimpleRateLimitGuard)
  update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewsService.update(+id, updateReviewDto);
  }

  @Delete(':id')
  @UseGuards(SimpleRateLimitGuard)
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(+id);
  }
}
