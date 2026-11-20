import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module.js';
import { ImagesModule } from '../images/images.module.js';
import { ToiletsModule } from '../toilets/toilets.module.js';

@Module({
  imports: [PrismaModule, ConfigModule, UsersModule, ImagesModule, ToiletsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
