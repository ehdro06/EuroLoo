import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_METERS = 5000; // 5km radius

@Injectable()
export class ToiletsService {
  constructor(private readonly httpService: HttpService) {}

  async fetchAndCleanToilets(lat: number, lng: number, radiusMeters?: number) {
    const radius = Math.max(300, Math.round((radiusMeters ?? SEARCH_RADIUS_METERS) / 100) * 100);

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="toilets"](around:${radius},${lat},${lng});
      );
      out body;
    `;

    try {
      const response = await firstValueFrom(
        this.httpService.post(OVERPASS_API_URL, query, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );
      
      const data = response.data;

      const cleanedToilets = data.elements.map((element: any) => {
        const fee = element.tags?.fee || "";
        const isFree = fee === "no";
        const isPaid = fee === "yes" || fee.includes("0.50") || fee.includes("1.00") || fee.includes("€");
        const wheelchair = element.tags?.wheelchair || "";

        return {
          id: element.id,
          lat: element.lat,
          lon: element.lon,
          name: element.tags?.name,
          operator: element.tags?.operator,
          fee,
          isFree,
          isPaid,
          openingHours: element.tags?.opening_hours,
          wheelchair,
          isAccessible: wheelchair === "yes",
        };
      });

      return cleanedToilets;
    } catch (error) {
      console.error("Error fetching from Overpass API:", error);
      throw new Error("Failed to fetch toilet data");
    }
  }
}
