import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

// What makes a contributor trusted enough for the higher daily limit: an account that has
// been around a while and whose photos are still up (moderators delete abusive ones).
export const TRUSTED_MIN_ACCOUNT_AGE_DAYS = 14;
export const TRUSTED_MIN_LIVE_PHOTOS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface UploadLimits {
  globalPerDay: number;
  userPerDay: number;
  trustedPerDay: number;
}

/**
 * Daily photo quotas, counted from upload grants in the database so every API instance
 * sees the same numbers. Days are UTC calendar days.
 *
 * - A global cap puts a ceiling on storage cost whatever happens.
 * - A per-user cap stops one account from using up the global cap for everyone.
 * - Trusted contributors get a higher per-user cap; admins have none.
 *
 * The check and the grant are not one transaction, so concurrent requests can pass the
 * cap by a few. That is fine for a cost ceiling.
 */
@Injectable()
export class UploadQuotaService {
  private readonly logger = new Logger(UploadQuotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get limits(): UploadLimits {
    const read = (key: string, fallback: number) => {
      const value = Number(this.config.get<string>(key));
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    return {
      globalPerDay: read('UPLOADS_GLOBAL_PER_DAY', 500),
      userPerDay: read('UPLOADS_USER_PER_DAY', 50),
      trustedPerDay: read('UPLOADS_TRUSTED_PER_DAY', 200),
    };
  }

  /** Throws 429 if this user may not start another upload today. */
  async assertCanUpload(user: Pick<User, 'id' | 'role' | 'createdAt'>, now = new Date()): Promise<void> {
    const dayStart = startOfUtcDay(now);
    const retryAfter = String(Math.ceil((dayStart.getTime() + DAY_MS - now.getTime()) / 1000));
    const limits = this.limits;

    const globalCount = await this.prisma.uploadGrant.count({ where: { createdAt: { gte: dayStart } } });
    if (globalCount >= limits.globalPerDay) {
      this.logger.warn(`Global photo upload cap reached (${globalCount}/${limits.globalPerDay} today)`);
      throw tooMany('Photo uploads are paused until tomorrow. Please try again then.', retryAfter);
    }

    if (user.role === 'ADMIN') return;

    const userLimit = (await this.isTrusted(user, now)) ? limits.trustedPerDay : limits.userPerDay;
    const userCount = await this.prisma.uploadGrant.count({
      where: { userId: user.id, createdAt: { gte: dayStart } },
    });
    if (userCount >= userLimit) {
      throw tooMany(`You've reached today's limit of ${userLimit} photos. You can add more tomorrow.`, retryAfter);
    }
  }

  async isTrusted(user: Pick<User, 'id' | 'createdAt'>, now = new Date()): Promise<boolean> {
    if (now.getTime() - user.createdAt.getTime() < TRUSTED_MIN_ACCOUNT_AGE_DAYS * DAY_MS) return false;
    const livePhotos = await this.prisma.image.count({ where: { userId: user.id } });
    return livePhotos >= TRUSTED_MIN_LIVE_PHOTOS;
  }
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function tooMany(message: string, retryAfterSeconds: string): HttpException {
  return new HttpException({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message, retryAfter: Number(retryAfterSeconds) }, HttpStatus.TOO_MANY_REQUESTS);
}
