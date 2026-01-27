"use client"

import { useEffect, useRef, useState, useLayoutEffect } from "react"
import { Map, Marker } from "pigeon-maps"
import type { Toilet } from "@/hooks/use-overpass"

interface MapContainerProps {
  toilets: Toilet[]
  loading: boolean
  onMarkerClick: (toilet: Toilet) => void
  onBoundsChange?: (payload: { center: [number, number]; zoom: number }) => void
  center?: [number, number]
  zoom?: number
  onZoomChange?: (zoom: number) => void
}

export function MapContainer({ toilets, loading, onMarkerClick, onBoundsChange, center: propCenter, zoom, onZoomChange, }: MapContainerProps) {
  console.log("[v0] MapContainer rendering with", toilets.length, "toilets")

  // Calculate center and zoom based on toilets unless a controlled `propCenter` is provided
  const computedCenter: [number, number] =
    toilets.length > 0
      ? [
          toilets.reduce((sum, t) => sum + t.lat, 0) / toilets.length,
          toilets.reduce((sum, t) => sum + t.lon, 0) / toilets.length,
        ]
      : [52.52, 13.405]
  const center = propCenter ?? computedCenter

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const sizeRef = useRef<{ width: number; height: number } | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const [thumbTop, setThumbTop] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
            const w = Math.round(rect.width)
            let h = Math.round(rect.height)
            // If the measured height is unexpectedly small (CSS 100% resolving to 0-very small),
            // fall back to using the viewport height minus the header (4rem / 64px) so the map fills.
            const MIN_REASONABLE_HEIGHT = 200
            if (h < MIN_REASONABLE_HEIGHT) {
              const headerPx = 64 // matches header h-16 (4rem)
              h = Math.max(h, Math.round(window.innerHeight - headerPx))
            }
        const prev = sizeRef.current
        if (!prev || Math.abs(prev.width - w) >= 3 || Math.abs(prev.height - h) >= 3) {
          sizeRef.current = { width: w, height: h }
          setSize({ width: w, height: h })
          console.log("[v0] MapContainer size updated:", { width: w, height: h })
        }
      }
    }

    measure()

    // Avoid ResizeObserver because pigeon-maps internal DOM updates (tile loads,
    // transforms, etc.) can trigger many RO callbacks and cause re-measure
    // loops. Use a debounced window resize handler instead.
    const resizeTimer = { id: 0 as number }
    const onResize = () => {
      if (resizeTimer.id) window.clearTimeout(resizeTimer.id)
      resizeTimer.id = window.setTimeout(measure, 150)
    }

    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
      if (resizeTimer.id) window.clearTimeout(resizeTimer.id)
    }
  }, [])

  useLayoutEffect(() => {
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!track || !thumb) return
    const rect = track.getBoundingClientRect()
    const padding = 12 // matches inset-y-3
    const innerHeight = rect.height - padding * 2
    const thumbH = thumb.getBoundingClientRect().height
    const MIN_Z = 1
    const MAX_Z = 18
    const z = zoom ?? 13
    const ratio = (z - MIN_Z) / (MAX_Z - MIN_Z) // 0..1
    const top = padding + (1 - ratio) * (innerHeight - thumbH)
    setThumbTop(Math.round(top))
  }, [zoom, size])

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Map
        width={size?.width}
        height={size?.height}
        center={center}
        zoom={zoom}
        boxClassname="h-full w-full"
        animate={false}
        onBoundsChanged={(payload) => {
          // payload: { center, zoom, bounds }
          onBoundsChange?.({ center: payload.center, zoom: payload.zoom })
        }}
      >
        {toilets.map((toilet) => (
          <Marker
            key={toilet.id}
            width={40}
            anchor={[toilet.lat, toilet.lon]}
            color={toilet.isFree ? "#22c55e" : toilet.isPaid ? "#f59e0b" : "#6b7280"}
            onClick={() => onMarkerClick(toilet)}
          />
        ))}
      </Map>
      {/* Zoom control: bottom-right vertical scrollbar with +/- buttons and draggable thumb */}
      <div className="absolute bottom-4 right-4 z-[1100] flex flex-col items-center gap-2">
        <button
          aria-label="Zoom in"
          onClick={() => onZoomChange?.(Math.min(18, (zoom ?? 13) + 1))}
          className="h-9 w-9 rounded-md bg-white/95 border border-black/10 shadow-sm flex items-center justify-center text-lg font-medium"
        >
          +
        </button>

        <div ref={trackRef} className="relative my-1 h-44 w-12 rounded-full bg-white/95 border border-black/10 shadow-sm flex items-center justify-center px-1" role="presentation">
          {/* subtle central track line */}
          <div className="absolute inset-y-4 left-1/2 -translate-x-1/2 w-2 rounded bg-black/10" style={{ width: 6 }} />

          {/* thumb (number) centered inside track horizontally; vertical position set by thumbTop */}
          <div
            ref={thumbRef}
            role="slider"
            aria-valuemin={1}
            aria-valuemax={18}
            aria-valuenow={zoom ?? 13}
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault()
              draggingRef.current = true

              const onMove = (ev: PointerEvent) => {
                if (!trackRef.current) return
                const rect = trackRef.current.getBoundingClientRect()
                const padding = 16 // inset-y-4 -> 1rem -> 16px
                const innerHeight = rect.height - padding * 2
                const y = ev.clientY - rect.top - padding
                const clamped = Math.max(0, Math.min(innerHeight, y))
                const MIN_Z = 1
                const MAX_Z = 18
                const rel = clamped / innerHeight // 0..1 from top
                // top => max zoom, so invert
                const zoomVal = Math.round(MIN_Z + (1 - rel) * (MAX_Z - MIN_Z))
                onZoomChange?.(Math.max(MIN_Z, Math.min(MAX_Z, zoomVal)))
              }

              const onUp = () => {
                draggingRef.current = false
                window.removeEventListener("pointermove", onMove)
                window.removeEventListener("pointerup", onUp)
              }

              window.addEventListener("pointermove", onMove)
              window.addEventListener("pointerup", onUp)
            }}
            className="absolute h-8 w-8 rounded-full bg-white border border-black/20 flex items-center justify-center text-sm font-medium cursor-grab"
            style={{ left: '50%', top: thumbTop != null ? `${thumbTop}px` : undefined, transform: `translate(-50%, 0)` }}
          >
            {zoom ?? 13}
          </div>
        </div>

        <button
          aria-label="Zoom out"
          onClick={() => onZoomChange?.(Math.max(1, (zoom ?? 13) - 1))}
          className="h-9 w-9 rounded-md bg-white/95 border border-black/10 shadow-sm flex items-center justify-center text-lg font-medium"
        >
          −
        </button>
      </div>

      {/* thumb position updated via useLayoutEffect */}
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/20 border-t-black" />
            <p className="text-sm font-medium text-black">Loading toilets...</p>
          </div>
        </div>
      )}
    </div>
  )
}
