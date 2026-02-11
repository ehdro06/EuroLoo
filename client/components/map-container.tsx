"use client"

import { useEffect, useRef, useState, useLayoutEffect } from "react"
import { Map, Marker, Overlay } from "pigeon-maps"
import { Locate, Check } from "lucide-react"
import type { Toilet } from "@/hooks/use-overpass"

interface MapContainerProps {
  toilets: Toilet[]
  loading: boolean
  onMarkerClick: (toilet: Toilet) => void
  onBoundsChange?: (payload: { center: [number, number]; zoom: number }) => void
  center?: [number, number]
  zoom?: number
  onZoomChange?: (zoom: number) => void
  userLocation?: [number, number] | null
  isSelectingLocation?: boolean
  onLocationSelect?: (latLng: [number, number]) => void
  onUserLocationRequest?: () => void
}

export function MapContainer({ 
  toilets, 
  loading, 
  onMarkerClick, 
  onBoundsChange, 
  center: propCenter, 
  zoom, 
  onZoomChange, 
  userLocation,
  isSelectingLocation,
  onLocationSelect,
  onUserLocationRequest
}: MapContainerProps) {
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
  const [showLoading, setShowLoading] = useState(false)

  // Internal state for immediate feedback loop (prevents stutter/snap from parent render lag)
  const [internalCenter, setInternalCenter] = useState(center)
  
  // Track the last center/zoom correctly reported by the map to distinguish 
  // between "User moved map" vs "App requested jump"
  const lastReportedCenter = useRef<[number, number]>(center ?? [52.52, 13.405])
  const lastReportedZoom = useRef<number>(zoom ?? 13)
  const currentZoomRef = useRef(zoom ?? 13) // Keep Ref for sync math logic

  const [transientCenter, setTransientCenter] = useState<[number, number] | undefined>(center)
  // Set initial transient zoom to undefined so we don't snap on hydration/mount unless strictly needed
  const [transientZoom, setTransientZoom] = useState<number | undefined>(undefined)
  const [displayZoom, setDisplayZoom] = useState(zoom ?? 13)

  // Fallback for first render: if no center prop provided, use computed
  // If center IS provided, transientCenter takes care of it.
  // We need `defaultCenter` only if transientCenter starts undefined.
  // But we initialized transientCenter with `center` which works for prop-based start.
  // If `center` is undefined, we use `computedCenter` as `defaultCenter`.

  // 1. Handle External Center Updates (e.g. initial load, search result)
  useEffect(() => {
    if (!center) return
    
    // Check if this center update is actually just the loopback from our own movement
    const [lat1, lon1] = lastReportedCenter.current
    const [lat2, lon2] = center
    const dist = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2))

    // Only force the map to move if the new center is significantly different (> ~1.1 meters)
    if (dist > 0.00001) {
       console.log("[Map] External center snap detected", dist)
       setTransientCenter(center)
    }
  }, [center])

  // 2. Handle External Zoom Updates (if any, though usually we control zoom locally)
  useEffect(() => {
    if (zoom === undefined) return
    if (Math.abs(zoom - lastReportedZoom.current) > 0.1) {
       // Only snap if significant difference
       setTransientZoom(zoom)
       setDisplayZoom(zoom)
    }
  }, [zoom])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (loading) {
      // Only show loading indicator if fetching takes longer than 1s
      timer = setTimeout(() => {
        setShowLoading(true)
      }, 1000)
    } else {
      setShowLoading(false)
    }
    return () => clearTimeout(timer)
  }, [loading])

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
    // Use displayZoom to drive the thumb position from state (smoother than mixing refs/state)
    const z = transientZoom ?? displayZoom
    const ratio = (z - MIN_Z) / (MAX_Z - MIN_Z) // 0..1
    const top = padding + (1 - ratio) * (innerHeight - thumbH)
    setThumbTop(Math.round(top))
    // Depend on internalCenter effectively as a "tick" for map updates
  }, [transientZoom, size, displayZoom]) 

  const lastClickRef = useRef<number>(0)

  return (
    <div 
      ref={containerRef} 
      className="relative h-full w-full touch-none overscroll-none"
      onMouseDownCapture={(e) => {
        const now = Date.now()
        // Prevent double-click zoom by stopping propagation of the second click
        if (now - lastClickRef.current < 300) {
           e.stopPropagation()
        }
        lastClickRef.current = now
      }}
    >
      <Map
        width={size?.width}
        height={size?.height}
        
        /* 
           Essential Logic:
           We only pass `center` or `zoom` when we want to force the map to a specific state.
           Otherwise, we pass `undefined` (via the transient states defaulting to undefined)
           so the component runs in Uncontrolled mode, handling its own gestures/physics.
        */
        center={transientCenter}
        zoom={transientZoom}
        zoomSnap={false}
        defaultCenter={toilets.length > 0 ? computedCenter : undefined}
        defaultZoom={13}
        
        boxClassname="h-full w-full touch-none"
        animate={true} // Always animate since we aren't fighting React updates anymore
        
        onBoundsChanged={(payload) => {
          // 1. Update our tracker refs so we know where the map thinks it is
          lastReportedCenter.current = payload.center
          lastReportedZoom.current = payload.zoom
          currentZoomRef.current = payload.zoom
          setDisplayZoom(payload.zoom) // Trigger render for UI updates (thumb/aria)

          // 2. Release any transient locks IMMEDIATELY.
          // Once the map has emitted an event, it has consumed the prop (if any).
          // We clear it so future renders don't keep snapping it back.
          if (transientCenter) setTransientCenter(undefined)
          if (transientZoom) setTransientZoom(undefined)
          
          // 3. Sync internal center logic (legacy, mostly for thumb now)
          if (internalCenter !== payload.center) {
            setInternalCenter(payload.center)
          }

          // 4. Propagate to parent
          onBoundsChange?.({ center: payload.center, zoom: payload.zoom })
        }}
        onClick={({ latLng }) => {
            if (isSelectingLocation && onLocationSelect) {
              onLocationSelect(latLng)
            }
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
        {userLocation && (
             <Overlay anchor={userLocation} offset={[10, 10]} className="pointer-events-none">
                 <div className="relative flex h-5 w-5 items-center justify-center">
                     <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                     <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-md"></span>
                 </div>
             </Overlay>
        )}
        {userLocation && isSelectingLocation && (
           <Overlay anchor={userLocation} offset={[0, 0]} className="pointer-events-none">
              <SelectionArea zoom={transientZoom ?? displayZoom} lat={userLocation[0]} />
           </Overlay>
        )}
      </Map>
      {/* Zoom control: bottom-right vertical scrollbar with +/- buttons and draggable thumb */}
      <div className="absolute bottom-6 right-4 z-[1100] flex origin-bottom-right scale-75 flex-col items-center gap-2 sm:bottom-4 sm:scale-100">
        <button
           aria-label="My Location"
           onClick={onUserLocationRequest}
           className="flex h-9 w-9 mb-2 items-center justify-center rounded-md border border-black/10 bg-white/95 text-lg font-medium shadow-sm text-black"
        >
            <Locate className="h-5 w-5" />
        </button>

        <button
          aria-label="Zoom in"
          onClick={() => {
            const next = Math.min(18, currentZoomRef.current + 1)
            setTransientZoom(next)
            onZoomChange?.(next)
          }}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white/95 text-lg font-medium shadow-sm"
        >
          +
        </button>

        <div
          ref={trackRef}
          className="relative my-1 flex h-32 w-12 touch-none items-center justify-center rounded-full border border-black/10 bg-white/95 px-1 shadow-sm sm:h-44" 
          role="presentation"
        >
          {/* subtle central track line */}
          <div className="absolute inset-y-4 left-1/2 -translate-x-1/2 w-2 rounded bg-black/10" style={{ width: 6 }} />

          {/* thumb (number) centered inside track horizontally; vertical position updated via useLayoutEffect */}
          <div
            ref={thumbRef}
            role="slider"
            aria-valuemin={1}
            aria-valuemax={18}
            aria-valuenow={Math.round(displayZoom)}
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault()
              e.currentTarget.setPointerCapture(e.pointerId); // Capture pointer
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
                // For slider, we probably want to update parent/display but maybe not transient zoom immediately to avoid snap?
                // Actually, slider changes ARE explicit control.
                const next = Math.max(MIN_Z, Math.min(MAX_Z, zoomVal))
                setTransientZoom(next) 
                onZoomChange?.(next)
              }

              const onUp = (ev: PointerEvent) => {
                 draggingRef.current = false
                 setTransientZoom(undefined) // Release on drop
                window.removeEventListener("pointermove", onMove)
                window.removeEventListener("pointerup", onUp)
              }

              window.addEventListener("pointermove", onMove)
              window.addEventListener("pointerup", onUp)
            }}
            className="absolute flex h-8 w-8 cursor-grab items-center justify-center rounded-full border border-black/20 bg-white text-sm font-medium touch-none"
            // Note: We use computed thumbTop from useLayoutEffect, but that depends on state. 
            // We need to trigger re-renders to update thumbTop, so we might need a state for currentZoom if we removed internalZoom.
            style={{ left: '50%', top: thumbTop != null ? `${thumbTop}px` : undefined, transform: `translate(-50%, 0)` }}
          >
            {Math.round(displayZoom)}
          </div>
        </div>

        <button
          aria-label="Zoom out"
          onClick={() => {
            const next = Math.max(1, currentZoomRef.current - 1)
            setTransientZoom(next)
            onZoomChange?.(next)
          }}
          className="h-9 w-9 rounded-md bg-white/95 border border-black/10 shadow-sm flex items-center justify-center text-lg font-medium"
        >
          −
        </button>
      </div>

      {/* thumb position updated via useLayoutEffect */}
      {showLoading && (
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

function SelectionArea({ zoom, lat }: { zoom: number; lat: number }) {
  // 50m radius
  const metersPerPixel = (156543.03 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
  const radiusPx = 50 / metersPerPixel
  const diameter = radiusPx * 2

  return (
    <div
      className="rounded-full border-2 border-dashed border-sky-500 bg-sky-500/20"
      style={{
        width: diameter,
        height: diameter,
        // Overlay centers the anchor (0,0) at the top-left of the div by default? 
        // No, Overlay offset system allows centering.
        // If I pass offset={[0,0]} to Overlay, it places the anchor at the Overlay's children's internal (0,0)?
        // Pigeon maps Overlay `offset` is [x, y] in pixels.
        // By default, the anchor point is at the top-left of the content.
        // So we need to translate by -radius.
        transform: `translate(-50%, -50%)`,
        pointerEvents: 'none' // Let clicks pass through to the map
      }}
    />
  )
}
