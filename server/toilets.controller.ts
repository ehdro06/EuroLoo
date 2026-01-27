import { Controller, Get, Query, UseInterceptors, Inject } from '@nestjs/common';
import { ToiletsService } from './toilets.service.js';
import { CacheInterceptor, CacheKey, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller('api')
export class ToiletsController {
  constructor(
    private readonly toiletsService: ToiletsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  @Get('toilets')
  async getToilets(@Query('lat') lat: string, @Query('lng') lng: string) {
    if (!lat || !lng) {
      throw new Error('Missing lat or lng parameters');
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    // Manual Caching Logic (simulated check-then-fetch)
    const roundedLat = latitude.toFixed(2);
    const roundedLng = longitude.toFixed(2);
    const cacheKey = `toilets_${roundedLat}_${roundedLng}`;

    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      console.log(`Cache HIT for key: ${cacheKey}`);
      return cachedData;
    }

    console.log(`Cache MISS for key: ${cacheKey}`);
    const data = await this.toiletsService.fetchAndCleanToilets(latitude, longitude);
    
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
}
