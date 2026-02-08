import { Module } from '@nestjs/common';
import { ToiletsModule } from './toilets/toilets.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    ToiletsModule,
    ReviewsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
