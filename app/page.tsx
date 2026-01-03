"use client"

import { useState, useRef } from "react"
import { MapPin, Filter, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToiletDrawer } from "@/components/toilet-drawer"
import { MapContainer } from "@/components/map-container"
import { useOverpass, type Toilet } from "@/hooks/use-overpass"

export default function HomePage() {
  const [showFreeOnly, setShowFreeOnly] = useState(false)
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null)
  // Controlled map center so moving the map can refetch data
  const [center, setCenter] = useState<[number, number]>([52.52, 13.405])
  const [zoom, setZoom] = useState<number>(13)
  const { toilets, loading, error } = useOverpass(center)

  // Debounce map moves so we don't refetch continuously while panning/zooming
  const pendingCenterRef = useRef<[number, number] | null>(null)
  const debounceTimer = useRef<number | null>(null)
  const DEBOUNCE_MS = 500

  const handleBoundsChange = (payload: { center: [number, number]; zoom?: number }) => {
    // Sync zoom immediately so the UI (thumb and number) updates with wheel events
    if (typeof payload.zoom === "number") {
      setZoom(payload.zoom)
    }

    // Debounce center updates to avoid frequent Overpass calls while panning
    pendingCenterRef.current = payload.center
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = window.setTimeout(() => {
      if (pendingCenterRef.current) {
        setCenter(pendingCenterRef.current)
        pendingCenterRef.current = null
      }
      debounceTimer.current = null
    }, DEBOUNCE_MS)
  }

  console.log("[v0] Toilets loaded:", toilets.length)
  console.log("[v0] Loading state:", loading)
  console.log("[v0] Error state:", error)

  const filteredToilets = showFreeOnly ? toilets.filter((t) => t.isFree) : toilets

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6" aria-hidden="true" />
            <h1 className="text-xl font-semibold tracking-tight text-black">EuroLoo</h1>
          </div>
          <Button
            variant={showFreeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFreeOnly(!showFreeOnly)}
            aria-label={showFreeOnly ? "Show all toilets" : "Show free toilets only"}
            className="gap-2"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{showFreeOnly ? "Free Only" : "All"}</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-1" style={{ height: "calc(100vh - 4rem)" }}>
        {error && (
          <div
            className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-lg border border-black/10 bg-white px-4 py-3 shadow-lg"
            role="alert"
          >
            <p className="text-sm font-medium text-black">{error}</p>
          </div>
        )}

        <MapContainer
          toilets={filteredToilets}
          loading={loading}
          onMarkerClick={setSelectedToilet}
          center={center}
          zoom={zoom}
          onBoundsChange={handleBoundsChange}
          onZoomChange={(z) => setZoom(z)}
        />

        {/* Privacy Badge */}
        <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 shadow-lg">
          <ShieldCheck className="h-4 w-4 text-black" aria-hidden="true" />
          <p className="text-xs font-medium text-black">
            Privacy Friendly: No Cookies, No Tracking. Powered by Open Data.
          </p>
        </div>
      </main>

      {/* Toilet Details Drawer */}
      <ToiletDrawer
        toilet={selectedToilet}
        open={!!selectedToilet}
        onOpenChange={(open) => !open && setSelectedToilet(null)}
      />
    </div>
  )
}
