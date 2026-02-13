import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}