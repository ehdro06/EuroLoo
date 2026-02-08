import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { ToiletsController } from './toilets.controller.js';
import { ToiletsService } from './toilets.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    HttpModule,
    CacheModule.register({
      ttl: 3600000, 
      max: 100,
    }),
    PrismaModule, 
  ],
  controllers: [ToiletsController],
  providers: [ToiletsService],
  exports: [ToiletsService],
})
export class ToiletsModule {}

