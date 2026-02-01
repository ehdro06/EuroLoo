"use client"

import { useEffect, useState, useRef } from "react"

export interface Toilet {
  id: number
  lat: number
  lon: number
  name?: string
  operator?: string
  fee?: string
  isFree: boolean
  isPaid: boolean
  openingHours?: string
  wheelchair?: string
  isAccessible: boolean
}

// const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter"

// Default center: Berlin, Germany
const DEFAULT_CENTER = { lat: 52.52, lon: 13.405 }
const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const BACKEND_API_URL = `${BASE_URL}/api/toilets`;

// center: [lat, lon]
const METERS_PER_PIXEL_AT_EQUATOR = 156543.03392;
const MAX_RADIUS_METERS = 30000; // ~city scale (30km)

function calculateRadiusMeters(lat: number, zoom: number) {
  const viewportSize = typeof window !== "undefined"
    ? Math.min(window.innerWidth, window.innerHeight)
    : 800;
  const metersPerPixel =
    (METERS_PER_PIXEL_AT_EQUATOR * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const raw = metersPerPixel * (viewportSize / 2);
  return Math.max(300, Math.round(raw / 100) * 100);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // meters
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useOverpass(
  center: [number, number] = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
  zoom: number = 13
) {
  const [toilets, setToilets] = useState<Toilet[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastCacheRef = useRef<{
    center: [number, number]
    radius: number
    toilets: Toilet[]
  } | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchToilets = async () => {
      try {
        setLoading(true)
        setError(null)

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
          const radius = calculateRadiusMeters(center[0], zoom);

          if (radius > MAX_RADIUS_METERS) {
            if (mounted) {
              setError("Zoom in to load data")
              setLoading(false)
            }
            return;
          }

          const cached = lastCacheRef.current;
          if (cached) {
            const distance = haversineMeters(
              cached.center[0],
              cached.center[1],
              center[0],
              center[1]
            );

            // If the new circle is fully covered by the cached circle, reuse and skip fetch.
            if (distance <= cached.radius - radius) {
              setToilets(cached.toilets);
              return;
            }

            // If partially overlapping, reuse cached immediately and refresh in background.
            if (distance <= cached.radius + radius) {
              setToilets(cached.toilets);
            }
          }

          const response = await fetch(
            `${BACKEND_API_URL}?lat=${center[0].toFixed(2)}&lng=${center[1].toFixed(2)}&radius=${radius}`,
            {
              signal: controller.signal
            }
          )
          clearTimeout(timeoutId);

          if (!response.ok) {
            console.log("[v0] Backend API response not ok:", response.statusText)
            throw new Error("Failed to fetch toilet data")
          }
  
          const newToilets: Toilet[] = await response.json()
  
          if (mounted) {
            setToilets(newToilets)
            lastCacheRef.current = {
              center: [center[0], center[1]],
              radius,
              toilets: newToilets
            }
          }
        } catch (error: any) {
             if (error.name === 'AbortError') {
                 console.error("[v0] Fetch request timed out");
                 throw new Error("Request timed out");
             }
             throw error;
        } finally {
            clearTimeout(timeoutId); 
        }
      } catch (err) {
        console.error("[v0] Error fetching toilets:", err)
        if (mounted) {
             setError("Map data unavailable, retry later")
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchToilets()

    return () => {
      mounted = false
    }
  }, [center[0], center[1], zoom]) // Re-fetch when center or zoom changes

  return { toilets, loading, error }
}
