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
const BASE_URL = "http://192.168.35.90:4000" || process.env.NEXT_PUBLIC_API_URL ;
const BACKEND_API_URL = `${BASE_URL}/api/toilets`;

// center: [lat, lon]
export function useOverpass(
  center: [number, number] = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
  zoom: number = 13
) {
  const [toilets, setToilets] = useState<Toilet[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchToilets = async () => {
      try {
        setLoading(true)
        setError(null)

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
          const response = await fetch(`${BACKEND_API_URL}?lat=${center[0].toFixed(2)}&lng=${center[1].toFixed(2)}`, {
            signal: controller.signal
          })
          clearTimeout(timeoutId);

          if (!response.ok) {
            console.log("[v0] Backend API response not ok:", response.statusText)
            throw new Error("Failed to fetch toilet data")
          }
  
          const newToilets: Toilet[] = await response.json()
  
          if (mounted) {
            setToilets(newToilets)
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
  }, [center[0], center[1]]) // Re-fetch when center changes

  return { toilets, loading, error }
}
