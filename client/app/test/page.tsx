"use client"

import { useState, useRef } from "react"
import { MapPin, Filter, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToiletDrawer } from "@/components/toilet-drawer"
import { MapContainer } from "@/components/map-container"
import { useOverpass, type Toilet } from "@/hooks/use-overpass"
import { Map } from "pigeon-maps"

export default function HomePage() {
  const [showFreeOnly, setShowFreeOnly] = useState(false)
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null)
  // Controlled map center vs debounced query center
  // `mapCenter` updates immediately so the map can preserve the user's
  // interaction (pointer zoom/pan) without snapping. `queryCenter` is
  // debounced and used for the Overpass request to avoid spamming the API.
  const [mapCenter, setMapCenter] = useState<[number, number]>([52.52, 13.405])
  const [queryCenter, setQueryCenter] = useState<[number, number]>(mapCenter)
  const [zoom, setZoom] = useState<number>(13)
  // We need to pass the zoom level to useOverpass so it can calculate the correct bounding box size
  // We use a queryZoom for fetching to avoid excessive API calls while zooming (similar to queryCenter)
  const [queryZoom, setQueryZoom] = useState<number>(13)
  const { toilets, loading, error } = useOverpass(queryCenter, queryZoom)

  // Debounce map moves so we don't refetch continuously while panning/zooming
  const pendingCenterRef = useRef<[number, number] | null>(null)
  const pendingZoomRef = useRef<number | null>(null)
  const lastQueryCenterRef = useRef<[number, number]>(mapCenter)
  const debounceTimer = useRef<number | null>(null)
  const DEBOUNCE_MS = 1000
  const MOVE_THRESHOLD = 0.002 // Approx 200m

  const handleBoundsChange = (payload: { center: [number, number]; zoom?: number }) => {
    // Sync zoom immediately so the UI (thumb and number) updates with wheel events
    if (typeof payload.zoom === "number") {
      setZoom(payload.zoom)
      pendingZoomRef.current = payload.zoom
    }

    // Update the map center immediately so the map's visual state (and the
    // zoom anchor) follows the user's pointer instead of snapping back when
    // the parent re-renders with an old center.
    setMapCenter(payload.center)

    // Debounce the center/zoom used for querying Overpass to avoid excessive API calls
    pendingCenterRef.current = payload.center
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = window.setTimeout(() => {
      // Only update query center if moved significantly to avoid tiny jitter triggering API
      if (pendingCenterRef.current) {
        const [lat1, lon1] = lastQueryCenterRef.current
        const [lat2, lon2] = pendingCenterRef.current
        const dist = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2))

        if (dist > MOVE_THRESHOLD) {
          setQueryCenter(pendingCenterRef.current)
          lastQueryCenterRef.current = pendingCenterRef.current
        }
        pendingCenterRef.current = null
      }
      
      if (pendingZoomRef.current != null) {
        setQueryZoom(pendingZoomRef.current)
        pendingZoomRef.current = null
      }
      debounceTimer.current = null
    }, DEBOUNCE_MS)
  }

  console.log("[v0] Toilets loaded:", toilets.length)
  console.log("[v0] Loading state:", loading)
  console.log("[v0] Error state:", error)

  const filteredToilets = showFreeOnly ? toilets.filter((t) => t.isFree) : toilets

  return (
   
         <Map
                width={600}
                height={700}
                center={[52.52, 13.405]}
                zoomSnap={false}>
                
        </Map>

       
  )
}
