import { Module } from '@nestjs/common';
import { ImagesService } from './images.service.js';
import { ImagesController } from './images.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [PrismaModule, ConfigModule, UsersModule],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
