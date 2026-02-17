import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { User, Role } from '@prisma/client';
import { clerkClient } from '@clerk/clerk-sdk-node';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

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
      await clerkClient.users.updateUser(clerkId, {
        publicMetadata: {
          role: role.toLowerCase(),
        },
      });
      this.logger.log(`Synced role ${role} for user ${clerkId} to Clerk`);
    } catch (error) {
       this.logger.error(`Failed to sync role to Clerk for user ${clerkId}: ${error.message}`);
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
