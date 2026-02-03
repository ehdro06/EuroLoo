"use client"

import { useGetToiletsQuery } from "@/lib/services/api"
import type { Toilet } from "@/lib/services/api" // Re-export or import from api
export type { Toilet } // Re-export for consumers

// Default center: Berlin, Germany
const DEFAULT_CENTER = { lat: 52.52, lon: 13.405 }

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

export function useOverpass(
  center: [number, number] = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
  zoom: number = 13
) {
  const radius = calculateRadiusMeters(center[0], zoom)
  
  // Stabilize inputs for RTK Query Cache (2 decimal places ~1.1km precision)
  // This matches the previous manual fetch implementation
  const lat = parseFloat(center[0].toFixed(2))
  const lng = parseFloat(center[1].toFixed(2))

  const skip = radius > MAX_RADIUS_METERS

  const { data: toilets = [], isLoading, isError, error: queryError } = useGetToiletsQuery(
    { lat, lng, radius },
    { 
       skip,
       // Optional: pollingInterval: 60000 
    }
  )

  const loading = isLoading
  const error = isError ? "Failed to load toilets" : (skip ? "Zoom in to load data" : null)

  return { toilets, loading, error }
}

