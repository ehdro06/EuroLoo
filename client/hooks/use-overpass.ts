"use client"

import { useState, useEffect } from "react"
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

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371000; // Radius of the earth in m
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in m
  return d;
}

export function useOverpass(
  center: [number, number] = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
  zoom: number = 13
) {
  const radius = calculateRadiusMeters(center[0], zoom)
  
  // Stabilize inputs for RTK Query Cache (1 decimal place ~11.1km precision)
  // We want coarse buckets so we hit the cache more often.
  // 1 decimal place = ~11.1km. 2 decimal places = ~1.11km.
  const lat = parseFloat(center[0].toFixed(1))
  const lng = parseFloat(center[1].toFixed(1))

  // Ensure we fetch a "safe area" around the user so they can pan without refetching immediately.
  // We take the larger of the view radius OR a minimum safe radius (e.g. 5km).
  const fetchRadius = Math.max(radius, 5000)

  // Smart caching: Keep track of the query args that were actually fetched.
  // If the new request is contained within the previously fetched area, don't update the query args.
  // This allows us to "zoom in" without hitting the API again.
  const [queryArgs, setQueryArgs] = useState({ lat, lng, radius: fetchRadius })

  useEffect(() => {
    // 1. Calculate distance from current request center to the cached center
    const dist = getDistanceFromLatLonInMeters(lat, lng, queryArgs.lat, queryArgs.lng)
    
    // 2. Check if the new request's circle is fully contained within the cached circle
    //    Condition: distance + new_radius <= cached_radius
    //    CRITICAL FIX: If the cached query was skipped (too big), we technically "contain" nothing.
    //    So we must allow the update if the previous one was skipped.
    const cachedQueryWasSkipped = queryArgs.radius > MAX_RADIUS_METERS
    const isContained = !cachedQueryWasSkipped && ((dist + radius) <= queryArgs.radius)

    // 3. If NOT contained, we must update the query args to fetch new data
    //    This covers zooming out (radius increases) and panning outside the cached area
    if (!isContained) {
      // Prevent infinite loop: if the inputs haven't changed but isContained is false 
      // (e.g. because we are in a skipped state > MAX_RADIUS), don't update state.
      // Use fetchRadius here since that is what we are trying to set
      if (queryArgs.lat === lat && queryArgs.lng === lng && queryArgs.radius === fetchRadius) {
        return
      }
      setQueryArgs({ lat, lng, radius: fetchRadius })
    }
  }, [lat, lng, radius, queryArgs, fetchRadius])

  const skip = queryArgs.radius > MAX_RADIUS_METERS

  const { data: toilets = [], isLoading, isError, error: queryError } = useGetToiletsQuery(
    queryArgs,
    { 
       skip,
       // Optional: pollingInterval: 60000 
    }
  )

  const loading = isLoading
  const error = isError ? "Failed to load toilets" : (skip ? "Zoom in to load data" : null)

  return { toilets, loading, error }
}

