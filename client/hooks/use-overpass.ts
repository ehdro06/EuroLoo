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
const BBOX_SIZE = 0.05 // ~5km radius
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/toilets";

// center: [lat, lon]
export function useOverpass(
  center: [number, number] = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
  bboxSize = BBOX_SIZE
) {
  const [toilets, setToilets] = useState<Toilet[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cache: map of id -> Toilet
  const cacheRef = useRef<Map<number, Toilet>>(new Map())
  // cached bbox covering fetched data
  const cachedBBoxRef = useRef<{ south: number; west: number; north: number; east: number } | null>(null)

  const PREFETCH_MULTIPLIER = 1.5

  useEffect(() => {
    let mounted = true

    const inBBox = (
      p: { lat: number; lon: number },
      b: { south: number; west: number; north: number; east: number }
    ) => p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east

    const bboxContains = (
      cached: { south: number; west: number; north: number; east: number } | null,
      view: { south: number; west: number; north: number; east: number }
    ) => {
      if (!cached) return false
      return cached.south <= view.south && cached.west <= view.west && cached.north >= view.north && cached.east >= view.east
    }

    const unionBBox = (
      a: { south: number; west: number; north: number; east: number } | null,
      b: { south: number; west: number; north: number; east: number }
    ) => {
      if (!a) return { ...b }
      return {
        south: Math.min(a.south, b.south),
        west: Math.min(a.west, b.west),
        north: Math.max(a.north, b.north),
        east: Math.max(a.east, b.east),
      }
    }

    const fetchForBBox = async (fetchBbox: { south: number; west: number; north: number; east: number }) => {
      try {
        setLoading(true)
        setError(null)

        // Calculate center of bbox to send to our new API
        // Our simple backend API just takes a center point (lat, lng) and fetches a fixed radius
        // To approximate the behavior, we'll use the center of the viewport
        const centerLat = (fetchBbox.south + fetchBbox.north) / 2;
        const centerLon = (fetchBbox.west + fetchBbox.east) / 2;

        const response = await fetch(`${BACKEND_API_URL}?lat=${centerLat}&lng=${centerLon}`)

        if (!response.ok) {
          console.log("[v0] Backend API response not ok:", response.statusText)
          throw new Error("Failed to fetch toilet data")
        }

        const newToilets: Toilet[] = await response.json()

        // Merge into cache (union strategy)
        const cache = cacheRef.current
        for (const t of newToilets) {
          cache.set(t.id, t)
        }


        // expand cached bbox
        cachedBBoxRef.current = unionBBox(cachedBBoxRef.current, fetchBbox)
      } catch (err) {
        console.error("[v0] Error fetching toilets:", err)
        setError("Map data unavailable, retry later")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    const viewBbox = {
      south: center[0] - bboxSize,
      west: center[1] - bboxSize,
      north: center[0] + bboxSize,
      east: center[1] + bboxSize,
    }

    // expanded viewport to prefetch around map
    const expanded = {
      south: center[0] - bboxSize * PREFETCH_MULTIPLIER,
      west: center[1] - bboxSize * PREFETCH_MULTIPLIER,
      north: center[0] + bboxSize * PREFETCH_MULTIPLIER,
      east: center[1] + bboxSize * PREFETCH_MULTIPLIER,
    }

    const cached = cachedBBoxRef.current

    // If cached bbox already contains the current view, simply filter cached points
    if (bboxContains(cached, viewBbox)) {
      const pts = Array.from(cacheRef.current.values()).filter((p) => inBBox(p, viewBbox))
      setToilets(pts)
      return () => {
        mounted = false
      }
    }

    // Need to fetch at least the expanded bbox (union with cached)
    const fetchBbox = unionBBox(cached, expanded)

    // Fetch and then set visible toilets from cache
    ;(async () => {
      await fetchForBBox(fetchBbox)
      if (!mounted) return
      const pts = Array.from(cacheRef.current.values()).filter((p) => inBBox(p, viewBbox))
      setToilets(pts)
    })()

    return () => {
      mounted = false
    }
  }, [center[0], center[1], bboxSize])

  return { toilets, loading, error }
}
