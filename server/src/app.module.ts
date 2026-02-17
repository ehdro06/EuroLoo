import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ToiletsModule } from './toilets/toilets.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { TestModule } from './test/test.module.js';
import { UsersModule } from './users/users.module.js';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'], // Load .env.local first
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 3600000, 
      max: 100,
    }),
    PrismaModule,
    ToiletsModule,
    ReviewsModule,
    UsersModule,
    WebhooksModule,
    TestModule,

  ],
  controllers: [AppController],
})
export class AppModule {}
