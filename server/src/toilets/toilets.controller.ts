import { Controller, Get, Post, Body, Query, Param, UseGuards, Req, Delete, ParseIntPipe } from '@nestjs/common';
import { ToiletsService } from './toilets.service.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SimpleRateLimitGuard } from '../common/guards/simple-rate-limit.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { CreateToiletDto } from './dto/create-toilet.dto.js';
import { FindToiletsDto, MIN_RADIUS_METERS } from './dto/find-toilets.dto.js';
import { ToiletsCacheService } from './toilets-cache.service.js';

@Controller('api')
export class ToiletsController {
  constructor(
    private readonly toiletsService: ToiletsService,
    private readonly cache: ToiletsCacheService,
  ) {}

  @Get('toilets/hidden')
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getHiddenToilets() {
    return this.toiletsService.findHidden();
  }

  @Post('toilets/:id/restore')
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async restoreToilet(@Param('id', ParseIntPipe) id: number) {
    await this.toiletsService.restoreToilet(id);
    await this.cache.invalidate();
    return { success: true };
  }

  @Delete('toilets/:id')
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteToilet(@Param('id', ParseIntPipe) id: number) {
    await this.toiletsService.deleteToilet(id);
    await this.cache.invalidate();
    return { success: true };
  }

  @Post('toilets')
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  async addToilet(@Body() dto: CreateToiletDto, @Req() req: AuthenticatedRequest) {
    const toilet = await this.toiletsService.createToilet(dto, req.user.id);

    // Invalidate all cached areas so the new toilet is visible immediately.
    // Fine at this scale; per-area invalidation would be the next step.
    await this.cache.invalidate();

    return toilet;
  }

  @Get('toilets')
  async getToilets(@Query() query: FindToiletsDto) {
    // Round to ~1km buckets so nearby requests share a cache entry
    const lat = Number(query.lat.toFixed(2));
    const lng = Number(query.lng.toFixed(2));
    const radius =
      query.radius !== undefined
        ? Math.max(MIN_RADIUS_METERS, Math.round(query.radius / 100) * 100)
        : undefined;
    const cacheKey = `toilets_${lat}_${lng}_${radius ?? 'default'}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.toiletsService.findInRadius(lat, lng, radius);
    await this.cache.set(cacheKey, data);
    return data;
  }

  @Get('toilets/:id/images')
  async getToiletImages(@Param('id', ParseIntPipe) id: number) {
    return this.toiletsService.findImagesByToilet(id);
  }

  @Post('toilets/:id/report')
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  async reportToilet(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    const result = await this.toiletsService.reportToilet(id, req.user.id);
    // Reports can hide a toilet, so cached results must be refreshed
    await this.cache.invalidate();
    return result;
  }

  @Post('toilets/:id/verify')
  @UseGuards(ClerkAuthGuard, SimpleRateLimitGuard)
  async verifyToilet(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    const result = await this.toiletsService.verifyToilet(id, req.user.id);
    await this.cache.invalidate();
    return result;
  }
}
