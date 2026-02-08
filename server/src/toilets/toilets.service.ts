import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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
}

