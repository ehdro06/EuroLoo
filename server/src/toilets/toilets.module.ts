import { Module } from '@nestjs/common';
import { ToiletsController } from './toilets.controller.js';
import { ToiletsService } from './toilets.service.js';
import { ToiletsCacheService } from './toilets-cache.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [ToiletsController],
  providers: [ToiletsService, ToiletsCacheService],
  exports: [ToiletsService, ToiletsCacheService],
})
export class ToiletsModule {}
