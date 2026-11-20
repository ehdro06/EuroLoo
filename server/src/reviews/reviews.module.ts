import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { ReviewsController } from './reviews.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { ToiletsModule } from '../toilets/toilets.module.js';

@Module({
  imports: [PrismaModule, UsersModule, ToiletsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
