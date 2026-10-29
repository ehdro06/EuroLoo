import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { SimpleRateLimitGuard } from '../common/guards/simple-rate-limit.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  create(@Body() createReviewDto: CreateReviewDto, @Req() req: AuthenticatedRequest) {
    return this.reviewsService.create(createReviewDto, req.user.id);
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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateReviewDto: UpdateReviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reviewsService.update(id, updateReviewDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.reviewsService.remove(id, req.user.id);
  }
}
