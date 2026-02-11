import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as crypto from 'node:crypto';

const SEARCH_RADIUS_METERS = 5000; // Default

@Injectable()
export class ToiletsService {
  constructor(private readonly prisma: PrismaService) {}

  async findInRadius(lat: number, lng: number, radiusMeters?: number) {
    const radius = Math.max(300, Math.round((radiusMeters ?? SEARCH_RADIUS_METERS) / 100) * 100);

    // Bounding Box Calculation
    // 1 Degree Latitude approx 111,000 meters
    const latDelta = radius / 111000;
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;

    // 1 Degree Longitude approx 111,000 * cos(lat) meters
    // Clamp lat to avoid poles div by zero issues (though toilets at poles unlikely)
    const latRad = lat * (Math.PI / 180);
    const lonDelta = radius / (111000 * Math.cos(latRad));
    
    const minLon = lng - lonDelta;
    const maxLon = lng + lonDelta;

    const toilets = await this.prisma.toilet.findMany({
      where: {
        lat: {
          gte: minLat,
          lte: maxLat,
        },
        lon: {
          gte: minLon,
          lte: maxLon,
        },
      },
    });

    // Optional: Filter precisely by circle radius using Harvesine in memory if strict accuracy is needed.
    // Box selection includes corners that are outside radius * sqrt(2).
    // For now, Box is usually fine for UI "load area" purposes.
    
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
  }) {
    const { userLat, userLng, ...toiletData } = data;

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

    // Duplicate Prevention: Check for existing toilets within ~20 meters
    const DUPLICATE_RADIUS = 20; 
    const delta = 0.0003; // ~33 meters approx safe buffer for DB query

    const nearbyToilets = await this.prisma.toilet.findMany({
      where: {
        lat: {
          gte: toiletData.lat - delta,
          lte: toiletData.lat + delta,
        },
        lon: {
          gte: toiletData.lng - delta,
          lte: toiletData.lng + delta,
        },
      },
    });

    for (const toilet of nearbyToilets) {
      const dist = this.getDistanceFromLatLonInMeters(
        toiletData.lat,
        toiletData.lng,
        toilet.lat,
        toilet.lon
      );
      if (dist < DUPLICATE_RADIUS) {
        throw new Error('A toilet already exists within 20 meters of this location.');
      }
    }

    // Generate a unique external ID for user-added toilets
    const externalId = `user-${crypto.randomUUID()}`;

    // Prepare data for Prisma (remove 'lng' which is not in schema, map to 'lon')
    const { lng, ...prismaData } = toiletData;

    return this.prisma.toilet.create({
      data: {
        ...prismaData,
        lon: lng, 
        externalId,
        isUserCreated: true,
      },
    });
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

