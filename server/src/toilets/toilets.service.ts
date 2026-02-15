import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as crypto from 'node:crypto';

const SEARCH_RADIUS_METERS = 5000; // Default

@Injectable()
export class ToiletsService {
  constructor(private readonly prisma: PrismaService) {}

  async findInRadius(lat: number, lng: number, radiusMeters?: number) {
    const radius = radiusMeters ?? SEARCH_RADIUS_METERS;

    // Use PostGIS for efficient geospatial querying
    // ST_DWithin uses the spatial index
    const toilets = await this.prisma.$queryRaw<any[]>`
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
    return toilets;
  }

  async createToilet(data: {
    lat: number;
    lng: number;
    name?: string;
    operator?: string;
    fee?: string;
    isFree?: boolean;
    isPaid?: boolean;
    openingHours?: string;
    wheelchair?: string;
    isAccessible?: boolean;
    userLat: number;
    userLng: number;
    clerkId: string;
  }) {
    const { userLat, userLng, clerkId, ...toiletData } = data;

    // Validate distance
    const distanceInfo = this.getDistanceFromLatLonInMeters(
      userLat,
      userLng,
      toiletData.lat,
      toiletData.lng
    );

    if (distanceInfo > 50) {
      throw new Error(
        `User is too far from the toilet location. Distance: ${distanceInfo.toFixed(2)}m. Must be within 50m.`
      );
    }

    // Duplicate Prevention: Check for existing toilets within 20 meters using PostGIS
    const DUPLICATE_RADIUS = 20; 

    const nearbyToilets: any[] = await this.prisma.$queryRaw`
      SELECT id 
      FROM "Toilet"
      WHERE ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${toiletData.lng}, ${toiletData.lat}), 4326)::geography,
        ${DUPLICATE_RADIUS}
      )
    `;

    if (nearbyToilets.length > 0) {
      throw new Error('A toilet already exists within 20 meters of this location.');
    }

    // Generate a unique external ID for user-added toilets
    const externalId = `user-${crypto.randomUUID()}`;

    // Prepare data for Prisma (remove 'lng' which is not in schema, map to 'lon')
    const { lng, ...prismaData } = toiletData;

    const newToilet = await this.prisma.toilet.create({
      data: {
        ...prismaData,
        lon: lng, 
        externalId,
        isUserCreated: true,
        contributor: { connect: { clerkId } },
      },
    });

    // CRITICAL: Populate the PostGIS location column for the new record
    await this.prisma.$executeRaw`
      UPDATE "Toilet" 
      SET location = ST_SetSRID(ST_MakePoint(${lng}, ${toiletData.lat}), 4326)
      WHERE id = ${newToilet.id}
    `;

    return newToilet;
  }

  async reportToilet(id: number) {
    let toilet = await this.prisma.toilet.update({
      where: { id },
      data: {
        reportCount: { increment: 1 },
      },
    });

    // Auto-hide logic: If reports > verifies + 3, hide it
    if (toilet.reportCount >= toilet.verifyCount + 3) {
      toilet = await this.prisma.toilet.update({
        where: { id },
        data: { isHidden: true },
      });
    }
    return toilet;
  }

  async verifyToilet(id: number) {
    let toilet = await this.prisma.toilet.update({
      where: { id },
      data: {
        verifyCount: { increment: 1 },
      },
    });

    // Auto-verify logic: If verifyCount >= 3, mark as verified
    if (toilet.verifyCount >= 3 && !toilet.isVerified) {
      toilet = await this.prisma.toilet.update({
        where: { id },
        data: { isVerified: true },
      });
    }
    console.log(toilet);
    return toilet;
  }

  private getDistanceFromLatLonInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {
    const R = 6371e3; // Radius of the earth in meters
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in meters
    return d;
  }

  private deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }
}

