import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ToiletsCacheService } from '../toilets/toilets-cache.service.js';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { SimpleRateLimitGuard } from '../common/guards/simple-rate-limit.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly toiletsCache: ToiletsCacheService,
  ) {}

  // Review answers feed the map's accessibility data, so cached map results go stale
  private async afterWrite<T>(result: T): Promise<T> {
    await this.toiletsCache.invalidate();
    return result;
  }

  @Post()
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  async create(@Body() createReviewDto: CreateReviewDto, @Req() req: AuthenticatedRequest) {
    return this.afterWrite(await this.reviewsService.create(createReviewDto, req.user.id));
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
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateReviewDto: UpdateReviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.afterWrite(await this.reviewsService.update(id, updateReviewDto, req.user.id));
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.afterWrite(await this.reviewsService.remove(id, req.user.id));
  }
}
