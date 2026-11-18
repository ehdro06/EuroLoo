import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { User, Role } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { displayNameFrom } from './display-name.js';

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

  // Users are normally created by the Clerk webhook; this covers requests that
  // arrive before (or without) it, and fills in a missing display name from Clerk.
  async ensureUser(clerkId: string): Promise<User> {
    const user = await this.prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, role: 'USER' },
    });
    if (user.username) return user;

    try {
      const profile = await this.clerkClient.users.getUser(clerkId);
      return await this.prisma.user.update({
        where: { clerkId },
        data: { username: displayNameFrom(profile) },
      });
    } catch (error) {
      // A missing name shouldn't block the user's action
      this.logger.warn(
        `Could not load Clerk profile for ${clerkId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return user;
    }
  }

  // Removes everything personal about a user. Toilets they added stay on the map,
  // without their name. Vote counters on toilets are kept (they're aggregates).
  // Returns the photo URLs so the caller can delete the stored files.
  async deleteAccountData(clerkId: string): Promise<{ imageUrls: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!user) return { imageUrls: [] };

    const images = await this.prisma.image.findMany({ where: { userId: user.id }, select: { url: true } });
    await this.prisma.$transaction([
      this.prisma.vote.deleteMany({ where: { userId: user.id } }),
      this.prisma.review.deleteMany({ where: { authorId: user.id } }),
      this.prisma.image.deleteMany({ where: { userId: user.id } }),
      this.prisma.toilet.updateMany({ where: { contributorId: user.id }, data: { contributorId: null } }),
      this.prisma.user.delete({ where: { id: user.id } }),
    ]);

    this.logger.log(`Deleted account data for ${clerkId} (${images.length} photos)`);
    return { imageUrls: images.map((image) => image.url) };
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
