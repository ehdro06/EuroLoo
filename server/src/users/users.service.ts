import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { User, Role } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private get clerkClient() {
    return createClerkClient({ secretKey: this.configService.get<string>('CLERK_SECRET_KEY') });
  }

  // Users are normally created by the Clerk webhook; this covers the case where
  // a request arrives before the webhook has been processed.
  async ensureUser(clerkId: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, role: 'USER' },
    });
  }

  async findByClerkId(clerkId: string) {
    return this.prisma.user.findUnique({
      where: { clerkId },
    });
  }

  async setRole(clerkId: string, role: Role) {
    const updatedUser = await this.prisma.user.update({
      where: { clerkId },
      data: { role },
    });

    try {
      await this.clerkClient.users.updateUser(clerkId, {
        publicMetadata: {
          role: role.toLowerCase(),
        },
      });
      this.logger.log(`Synced role ${role} for user ${clerkId} to Clerk`);
    } catch (error) {
       this.logger.error(`Failed to sync role to Clerk for user ${clerkId}: ${error instanceof Error ? error.message : String(error)}`);
       // We don't throw here to avoid rolling back the DB change, 
       // but in a production system we might want better consistency.
    }
    
    return updatedUser;
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
