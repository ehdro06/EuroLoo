import { Controller, Get, Post, Body, Query, UseInterceptors, Inject, BadRequestException, Param } from '@nestjs/common';
import { ToiletsService } from './toilets.service.js';
import { CacheInterceptor, CacheKey, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller('api')
export class ToiletsController {
  constructor(
    private readonly toiletsService: ToiletsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  @Post('toilets')
  async addToilet(@Body() body: any) {
    if (!body.lat || !body.lng || !body.userLat || !body.userLng) {
      throw new BadRequestException('Missing required fields: lat, lng, userLat, userLng');
    }

    try {
      const newToilet = await this.toiletsService.createToilet({
        lat: parseFloat(body.lat),
        lng: parseFloat(body.lng),
        userLat: parseFloat(body.userLat),
        userLng: parseFloat(body.userLng),
        name: body.name,
        operator: body.operator,
        fee: body.fee,
        isFree: body.isFree,
        isPaid: body.isPaid,
        openingHours: body.openingHours,
        wheelchair: body.wheelchair,
        isAccessible: body.isAccessible,
      });

      // Invalidate cache for the area 
      // Simple approach: Clear entire cache on new addition to ensure visibility.
      // This is acceptable for MVP scale.
      await this.cacheManager.clear(); 

      return newToilet;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('too far')) {
          throw new BadRequestException(error.message);
        }
        if (error.message.includes('already exists')) {
          throw new BadRequestException(error.message);
        }
      }
      throw error;
    }
  }

  @Get('toilets')
  async getToilets(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string
  ) {
    if (!lat || !lng) {
      throw new Error('Missing lat or lng parameters');
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    // Manual Caching Logic (simulated check-then-fetch)
    const roundedLat = latitude.toFixed(2);
    const roundedLng = longitude.toFixed(2);
    const radiusMeters = radius
      ? Math.max(300, Math.round(parseFloat(radius) / 100) * 100)
      : undefined;
    const cacheKey = `toilets_${roundedLat}_${roundedLng}_${radiusMeters ?? 'default'}`;

    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      console.log(`Cache HIT for key: ${cacheKey}`);
      return cachedData;
    }

    console.log(`Cache MISS for key: ${cacheKey}`);
    const data = await this.toiletsService.findInRadius(
      parseFloat(roundedLat),
      parseFloat(roundedLng),
      radiusMeters
    );
    
    // Save to cache manually to control the key format strictly
    await this.cacheManager.set(cacheKey, data, 3600000); // 1 hour in ms (Nest cache-manager v5 uses ms)

    return data;
  }

  @Get('debug/cache')
  async getDebugCache() {
    // Note: cache-manager doesn't standardly expose .keys() or .getStats() easily across all stores
    // But for the in-memory store, we can try to access the underlying store
    const store = (this.cacheManager as any).store;
    let keys = [];
    
    if (store.keys) {
      keys = await store.keys();
    }

    // Returning what we can find for debug
    return {
      keys,
      message: "Cache inspection depends on underlying store driver"
    };
  }

  @Post('toilets/:id/report')
  async reportToilet(@Param('id') id: string) {
    const toiletId = parseInt(id, 10);
    if (isNaN(toiletId)) {
      throw new BadRequestException('Invalid toilet ID');
    }
    const result = await this.toiletsService.reportToilet(toiletId);
    
    // Invalidate cache so everyone sees this toilet is hidden/reported
    await this.cacheManager.clear();
    
    return result;
  }

  @Post('toilets/:id/verify')
  async verifyToilet(@Param('id') id: string) {
    const toiletId = parseInt(id, 10);
    if (isNaN(toiletId)) {
      throw new BadRequestException('Invalid toilet ID');
    }
    const result = await this.toiletsService.verifyToilet(toiletId);

    // Invalidate cache so everyone sees the new Verified status
    await this.cacheManager.clear();

    return result;
  }

  @Get('toilets/test/clearcache')
  async clearCache() {    
    await this.cacheManager.clear();
    console.log("cacheCleared");
    
  }
}
