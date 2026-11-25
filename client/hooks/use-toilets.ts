"use client"

import { useEffect, useRef, useState } from "react"
import { coversView, planQueryArea, type QueryArea } from "@/lib/query-area"
import { useGetToiletsQuery } from "@/lib/services/api"
import type { Toilet } from "@/lib/services/api" // Re-export or import from api
export type { Toilet } // Re-export for consumers

// Default center: Berlin, Germany
const DEFAULT_CENTER = { lat: 52.52, lon: 13.405 }

// center: [lat, lon]
const METERS_PER_PIXEL_AT_EQUATOR = 156543.03392;
const MAX_RADIUS_METERS = 30000; // ~city scale (30km)

function calculateRadiusMeters(lat: number, zoom: number) {
  // Half the screen diagonal, so the circle reaches the corners of the view
  const halfDiagonalPx = typeof window !== "undefined"
    ? Math.hypot(window.innerWidth, window.innerHeight) / 2
    : 565;
  const metersPerPixel =
    (METERS_PER_PIXEL_AT_EQUATOR * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const raw = metersPerPixel * halfDiagonalPx;
  return Math.max(300, Math.round(raw / 100) * 100);
}

export function useToilets(
  center: [number, number] = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
  zoom: number = 13
) {
  const radius = calculateRadiusMeters(center[0], zoom)
  
  // Keep the last fetched area while it still covers the view, so zooming in
  // or small pans don't hit the API again
  const [queryArgs, setQueryArgs] = useState<QueryArea>(() => planQueryArea(center, radius))

  // Adjust during render (instead of in an effect) so the query updates in the same pass.
  // A skipped query (area too large) covers nothing, so always replan after one.
  const cachedQueryWasSkipped = queryArgs.radius > MAX_RADIUS_METERS
  if (cachedQueryWasSkipped || !coversView(queryArgs, center, radius)) {
    const next = planQueryArea(center, radius)
    const unchanged = queryArgs.lat === next.lat && queryArgs.lng === next.lng && queryArgs.radius === next.radius
    if (!unchanged) setQueryArgs(next)
  }

  const skip = queryArgs.radius > MAX_RADIUS_METERS

  const { data: toilets = [], isLoading, isError, isFetching, refetch } = useGetToiletsQuery(queryArgs, { skip })

  // A failed request isn't retried on its own: while the view stays inside the same
  // area, the query arguments don't change. So try again whenever the user moves or
  // zooms the map after a failure. (A successful empty answer is kept: the server
  // returns every toilet in the area, so asking again wouldn't find more.)
  const viewKey = `${center[0]},${center[1]},${zoom}`
  const failedAtViewRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isError) {
      failedAtViewRef.current = null
      return
    }
    if (failedAtViewRef.current === null) {
      failedAtViewRef.current = viewKey
    } else if (failedAtViewRef.current !== viewKey && !isFetching && !skip) {
      failedAtViewRef.current = viewKey
      refetch()
    }
  }, [isError, isFetching, skip, viewKey, refetch])

  const loading = isLoading
  const error = isError ? "Failed to load toilets" : (skip ? "Zoom in to load data" : null)

  // For a "Try again" button
  const retry = () => {
    if (!skip) refetch()
  }

  return { toilets, loading, error, failed: isError, retry }
}

