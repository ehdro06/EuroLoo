import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ToiletsModule } from './toilets/toilets.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { UsersModule } from './users/users.module.js';
import { ImagesModule } from './images/images.module.js';
import { CacheModule } from '@nestjs/cache-manager';
import { SimpleRateLimitGuard } from './common/guards/simple-rate-limit.guard.js';
import { RedisModule } from './redis/redis.module.js';
import { TOILETS_CACHE_TTL_MS } from './toilets/toilets-cache.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'], // Load .env.local first
    }),
    // In-memory cache, used when Redis (REDIS_URL) isn't configured or is down
    CacheModule.register({
      isGlobal: true,
      ttl: TOILETS_CACHE_TTL_MS,
    }),
    RedisModule,
    PrismaModule,
    ToiletsModule,
    ReviewsModule,
    UsersModule,
    WebhooksModule,
    ImagesModule,
  ],
  controllers: [AppController],
  providers: [SimpleRateLimitGuard],
})
export class AppModule {}
