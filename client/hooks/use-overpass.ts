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
  
  // Stabilize inputs for RTK Query Cache (2 decimal places ~1.1km precision)
  // This matches the previous manual fetch implementation
  const lat = parseFloat(center[0].toFixed(2))
  const lng = parseFloat(center[1].toFixed(2))

  // Smart caching: Keep track of the query args that were actually fetched.
  // If the new request is contained within the previously fetched area, don't update the query args.
  // This allows us to "zoom in" without hitting the API again.
  const [queryArgs, setQueryArgs] = useState({ lat, lng, radius })

  useEffect(() => {
    // 1. Calculate distance from current request center to the cached center
    const dist = getDistanceFromLatLonInMeters(lat, lng, queryArgs.lat, queryArgs.lng)
    
    // 2. Check if the new request's circle is fully contained within the cached circle
    //    Condition: distance + new_radius <= cached_radius
    const isContained = (dist + radius) <= queryArgs.radius

    // 3. If NOT contained, we must update the query args to fetch new data
    //    This covers zooming out (radius increases) and panning outside the cached area
    if (!isContained) {
      setQueryArgs({ lat, lng, radius })
    }
  }, [lat, lng, radius, queryArgs])

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

