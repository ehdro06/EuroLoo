import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('api/test')
export class TestController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  @Get('clearcache')
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async clearCache() {
    await this.cacheManager.clear();
    return { status: 'Cache Cleared' };
  }
}
