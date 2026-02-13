import { Controller, Get, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller('api/test')
export class TestController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  @Get('clearcache')
  async clearCache() {
    await this.cacheManager.clear();
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    console.log(WEBHOOK_SECRET ? "secret detected " : "nope");
    console.log("cacheCleared");
    return { 
        status: 'Cache Cleared', 
        secretDetected: !!WEBHOOK_SECRET 
    };
  }
}
