import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { isRecordNotFoundError, isUniqueConstraintError } from '../common/prisma-errors.js';
import { CreateToiletDto } from './dto/create-toilet.dto.js';

export const DEFAULT_SEARCH_RADIUS_METERS = 5000;
// A contributor must be standing within this distance of the toilet they add
export const MAX_SUBMIT_DISTANCE_METERS = 50;
// Toilets closer than this to an existing one are treated as duplicates
export const DUPLICATE_RADIUS_METERS = 20;
// A toilet is auto-hidden once reports exceed verifications by this margin
export const AUTO_HIDE_REPORT_MARGIN = 3;
export const AUTO_VERIFY_THRESHOLD = 3;

export type VoteType = 'VERIFY' | 'REPORT';

export interface ToiletRow {
  id: number;
  externalId: string;
  lat: number;
  lon: number;
  name: string | null;
  operator: string | null;
  fee: string | null;
  isFree: boolean;
  isPaid: boolean;
  openingHours: string | null;
  wheelchair: string | null;
  isAccessible: boolean;
  isUserCreated: boolean;
  isVerified: boolean;
  reportCount: number;
  verifyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ToiletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async findInRadius(lat: number, lng: number, radiusMeters?: number): Promise<ToiletRow[]> {
    const radius = radiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS;

    // ST_DWithin on geography uses the spatial index
    return this.prisma.$queryRaw<ToiletRow[]>`
      SELECT
        id, "externalId", lat, lon, name, operator, fee, "isFree", "isPaid",
        "openingHours", wheelchair, "isAccessible", "isUserCreated", "createdAt", "updatedAt",
        "isVerified", "reportCount", "verifyCount"
      FROM "Toilet"
      WHERE "isHidden" = false
        AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radius}
      )
    `;
  }

  async createToilet(dto: CreateToiletDto, clerkId: string) {
    const { userLat, userLng, lat, lng, ...details } = dto;

    const distance = getDistanceInMeters(userLat, userLng, lat, lng);
    if (distance > MAX_SUBMIT_DISTANCE_METERS) {
      throw new BadRequestException(
        `You are too far from the toilet location (${distance.toFixed(0)}m). Must be within ${MAX_SUBMIT_DISTANCE_METERS}m.`,
      );
    }

    const contributor = await this.usersService.ensureUser(clerkId);

    return this.prisma.$transaction(async (tx) => {
      const nearby = await tx.$queryRaw<{ id: number }[]>`
        SELECT id
        FROM "Toilet"
        WHERE ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${DUPLICATE_RADIUS_METERS}
        )
        LIMIT 1
      `;
      if (nearby.length > 0) {
        throw new ConflictException(`A toilet already exists within ${DUPLICATE_RADIUS_METERS} meters of this location.`);
      }

      const toilet = await tx.toilet.create({
        data: {
          ...details,
          lat,
          lon: lng,
          externalId: `user-${crypto.randomUUID()}`,
          isUserCreated: true,
          contributorId: contributor.id,
        },
      });

      // Prisma can't write the PostGIS column, so populate it in the same transaction
      await tx.$executeRaw`
        UPDATE "Toilet"
        SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
        WHERE id = ${toilet.id}
      `;

      return toilet;
    });
  }

  reportToilet(id: number, clerkId: string) {
    return this.vote(id, clerkId, 'REPORT');
  }

  verifyToilet(id: number, clerkId: string) {
    return this.vote(id, clerkId, 'VERIFY');
  }

  private async vote(toiletId: number, clerkId: string, type: VoteType) {
    const user = await this.usersService.ensureUser(clerkId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // The @@unique([userId, toiletId, type]) constraint rejects duplicate votes
        await tx.vote.create({ data: { type, userId: user.id, toiletId } });

        const counter: Prisma.ToiletUpdateInput =
          type === 'REPORT' ? { reportCount: { increment: 1 } } : { verifyCount: { increment: 1 } };
        const toilet = await tx.toilet.update({ where: { id: toiletId }, data: counter });

        if (type === 'REPORT' && toilet.reportCount >= toilet.verifyCount + AUTO_HIDE_REPORT_MARGIN) {
          return tx.toilet.update({ where: { id: toiletId }, data: { isHidden: true } });
        }
        if (type === 'VERIFY' && toilet.verifyCount >= AUTO_VERIFY_THRESHOLD && !toilet.isVerified) {
          return tx.toilet.update({ where: { id: toiletId }, data: { isVerified: true } });
        }
        return toilet;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          type === 'REPORT' ? 'You have already reported this toilet.' : 'You have already verified this toilet.',
        );
      }
      // Foreign key violation (P2003) or missing record (P2025) both mean the toilet doesn't exist
      if (
        isRecordNotFoundError(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
      ) {
        throw new NotFoundException('Toilet not found');
      }
      throw error;
    }
  }

  // --- Images ---

  async findImagesByToilet(toiletId: number) {
    return this.prisma.image.findMany({
      where: { toiletId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, url: true, createdAt: true, user: { select: { username: true } } },
    });
  }

  // --- Admin Methods ---

  async findHidden() {
    return this.prisma.toilet.findMany({
      where: { isHidden: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async restoreToilet(id: number) {
    try {
      return await this.prisma.toilet.update({
        where: { id },
        data: { isHidden: false, reportCount: 0 },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) throw new NotFoundException('Toilet not found');
      throw error;
    }
  }

  async deleteToilet(id: number) {
    try {
      // Votes have no cascade rule, so remove them first
      return await this.prisma.$transaction([
        this.prisma.vote.deleteMany({ where: { toiletId: id } }),
        this.prisma.toilet.delete({ where: { id } }),
      ]);
    } catch (error) {
      if (isRecordNotFoundError(error)) throw new NotFoundException('Toilet not found');
      throw error;
    }
  }
}

// Haversine distance between two coordinates
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
