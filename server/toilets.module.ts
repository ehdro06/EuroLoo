import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { ToiletsController } from './toilets.controller.js';
import { ToiletsService } from './toilets.service.js';
import { HealthController } from './health.controller.js';
import { ReviewsModule } from './src/reviews/reviews.module';

@Module({
  imports: [
    HttpModule,
    CacheModule.register({
      ttl: 3600000, // 1 hour (milliseconds for cache-manager v5)
      max: 100,
    }),
    ReviewsModule,
  ],
  controllers: [ToiletsController, HealthController],
  providers: [ToiletsService],
})
export class ToiletsModule {}
