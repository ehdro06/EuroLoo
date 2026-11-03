"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Filter, ShieldCheck, Plus, LocateFixed, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToiletDrawer } from "@/components/toilet-drawer"
import { MapContainer } from "@/components/map-container"
import { useToilets, type Toilet } from "@/hooks/use-toilets"
import { AddToiletDialog } from "@/components/add-toilet-dialog"
import { toast } from "sonner"
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import { useSignInHere } from "@/hooks/use-sign-in-here"
import Image from "next/image"

// iOS Safari exposes the compass heading and a permission prompt on orientation events.
type CompassOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number }
type IOSDeviceOrientationEvent = { requestPermission?: () => Promise<'granted' | 'denied'> }

const DEFAULT_VIEW: MapView = { center: [52.52, 13.405], zoom: 13, toiletId: null, fromUrl: false }
// Zoom used when centering on the user's location the first time
const USER_LOCATION_ZOOM = 15

type MapView = { center: [number, number]; zoom: number; toiletId: number | null; fromUrl: boolean }

// The map position and the open toilet live in the URL (?lat=&lng=&z=&toilet=)
// so they survive a reload, e.g. the redirect back from signing in.
function parseMapView(params: URLSearchParams): MapView {
  const lat = Number(params.get("lat"))
  const lng = Number(params.get("lng"))
  const zoom = Number(params.get("z"))
  const toiletId = Number(params.get("toilet"))
  const hasCenter =
    params.has("lat") && params.has("lng") && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  return {
    center: hasCenter ? [lat, lng] : DEFAULT_VIEW.center,
    zoom: params.has("z") && zoom >= 3 && zoom <= 19 ? zoom : DEFAULT_VIEW.zoom,
    toiletId: Number.isInteger(toiletId) && toiletId > 0 ? toiletId : null,
    fromUrl: hasCenter,
  }
}

export default function Page() {
  // useSearchParams needs a Suspense boundary on statically rendered pages
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  )
}

function HomePage() {
  const openSignIn = useSignInHere();
  const { user } = useUser();
  const searchParams = useSearchParams()
  const [initialView] = useState(() => parseMapView(searchParams))
  const [showFreeOnly, setShowFreeOnly] = useState(false)
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null)
  // Toilet to reopen once the map data has loaded (from the URL)
  const [restoreToiletId, setRestoreToiletId] = useState<number | null>(initialView.toiletId)

  // New State for Location/Adding
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [userHeading, setUserHeading] = useState<number | null>(null)
  const [isAddingToilet, setIsAddingToilet] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newToiletLocation, setNewToiletLocation] = useState<{lat: number, lng: number} | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [followMe, setFollowMe] = useState(false)
  const followMeRef = useRef(followMe)
  
  // Controlled map center vs debounced query center
  // `mapCenter` updates immediately so the map can preserve the user's
  // interaction (pointer zoom/pan) without snapping. `queryCenter` is
  // debounced and used for the toilets API request to avoid spamming the API.
  const [mapCenter, setMapCenter] = useState<[number, number]>(initialView.center)
  const [queryCenter, setQueryCenter] = useState<[number, number]>(mapCenter)
  const [zoom, setZoom] = useState<number>(initialView.zoom)
  // We need to pass the zoom level to useToilets so it can calculate the correct bounding box size
  // We use a queryZoom for fetching to avoid excessive API calls while zooming (similar to queryCenter)
  const [queryZoom, setQueryZoom] = useState<number>(initialView.zoom)
  const { toilets, loading, error } = useToilets(queryCenter, queryZoom)

  if (restoreToiletId !== null && !loading) {
    setRestoreToiletId(null)
    const toilet = toilets.find((t) => t.id === restoreToiletId)
    if (toilet) setSelectedToilet(toilet)
  }

  // Mirror the map view into the URL (debounced; browsers rate-limit history updates)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      params.set("lat", mapCenter[0].toFixed(5))
      params.set("lng", mapCenter[1].toFixed(5))
      params.set("z", String(Math.round(zoom)))
      const toiletId = selectedToilet?.id ?? restoreToiletId
      if (toiletId) params.set("toilet", String(toiletId))
      else params.delete("toilet")
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [mapCenter, zoom, selectedToilet, restoreToiletId])

  // Debounce map moves so we don't refetch continuously while panning/zooming
  const pendingCenterRef = useRef<[number, number] | null>(null)
  const pendingZoomRef = useRef<number | null>(null)
  const lastQueryCenterRef = useRef<[number, number]>(mapCenter)
  const debounceTimer = useRef<number | null>(null)
  const DEBOUNCE_MS = 500
  const MOVE_THRESHOLD = 0.002 // Approx 200m

  // Device orientation state
  const [orientationGranted, setOrientationGranted] = useState(false)

  // Start in Berlin, then jump to the user's location once they grant permission.
  // Skipped for shared/restored links (URL has a position) and once the user
  // has moved the map themselves, so we never yank the map away from them.
  const shouldAutoCenterRef = useRef(!initialView.fromUrl)

  // Initial Geolocation
  useEffect(() => {
    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
       watchId = navigator.geolocation.watchPosition(
         (pos) => {
           const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
           setUserLocation(coords)
           // Only use GPS heading if we don't have compass orientation
           if (!orientationGranted && pos.coords.heading !== null && !Number.isNaN(pos.coords.heading)) {
             setUserHeading(pos.coords.heading)
           }
           
           if (shouldAutoCenterRef.current) {
             shouldAutoCenterRef.current = false
             setMapCenter(coords)
             setQueryCenter(coords)
             lastQueryCenterRef.current = coords
             setZoom(USER_LOCATION_ZOOM)
             setQueryZoom(USER_LOCATION_ZOOM)
           } else if (followMeRef.current) {
             setMapCenter(coords)
             setQueryCenter(coords)
           }
         },
         (err) => console.log("Location access denied or failed", err),
         { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
       )
    }
    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [orientationGranted]) 

  // Compass orientation listener
  useEffect(() => {
    if (!orientationGranted) return;

    const handleOrientation = (event: CompassOrientationEvent) => {
      let heading: number | null = null;
      if (event.webkitCompassHeading) {
        // iOS
        heading = event.webkitCompassHeading;
      } else if (event.alpha !== null) {
        // Android absolute orientation
        // alpha is 0 when top of device is pointing South? Actually it varies. 
        // We'll approximate for Android if 'deviceorientationabsolute' is used.
        // Standard deviceorientation alpha is relative.
        heading = 360 - event.alpha;
      }
      
      if (heading !== null) {
        setUserHeading(heading);
      }
    };

    const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(eventName, handleOrientation);
    
    return () => {
      window.removeEventListener(eventName, handleOrientation);
    };
  }, [orientationGranted])

  const handleUserLocationRequest = async () => {
    if (!navigator.geolocation) {
         toast.error("Error", { description: "Geolocation not supported" })
         return
    }

    // Request compass permission on iOS
    const OrientationEvent = (window as Window & { DeviceOrientationEvent?: IOSDeviceOrientationEvent }).DeviceOrientationEvent
    if (typeof OrientationEvent?.requestPermission === 'function') {
      try {
        const permission = await OrientationEvent.requestPermission()
        if (permission === 'granted') {
          setOrientationGranted(true)
        }
      } catch (err) {
        console.error("Compass permission error:", err)
      }
    } else {
      // Android or non-iOS 13+ devices
      setOrientationGranted(true)
    }

    // Toggle follow me mode
    const newState = !followMe;
    setFollowMe(newState);
    followMeRef.current = newState;
    
    if (newState) {
      if (userLocation) {
        setMapCenter(userLocation);
        setZoom(16);
      } else {
        setIsLocating(true)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsLocating(false)
            const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
            setUserLocation(coords)
            if (!orientationGranted && pos.coords.heading !== null && !Number.isNaN(pos.coords.heading)) {
              setUserHeading(pos.coords.heading)
            }
            setMapCenter(coords)
            setZoom(16) // Zoom in when locating
          },
          () => {
             setIsLocating(false)
             setFollowMe(false)
             followMeRef.current = false
             toast.error("Location Error", { description: "Could not retrieve location. Please check permissions." })
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
      }
    }
  }

  const handleBoundsChange = (payload: { center: [number, number]; zoom?: number }) => {
    // Sync zoom immediately so the UI (thumb and number) updates with wheel events
    if (typeof payload.zoom === "number") {
      setZoom(payload.zoom)
      pendingZoomRef.current = payload.zoom
    }

    // Disable follow-me if user manually panned
    const [lat1, lon1] = lastQueryCenterRef.current
    const [lat2, lon2] = payload.center
    const mapMoveDist = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2))
    // Only turn off follow me if the map was moved significantly, not just a jitter
    if (followMeRef.current && mapMoveDist > 0.0001) {
       // Also verify it's not because we programmatically set it to userLocation
       if (userLocation) {
         const distToUser = Math.sqrt(Math.pow(lat2 - userLocation[0], 2) + Math.pow(lon2 - userLocation[1], 2))
         if (distToUser > 0.0001) {
            setFollowMe(false);
            followMeRef.current = false;
         }
       }
    }

    // Update the map center immediately so the map's visual state (and the
    // zoom anchor) follows the user's pointer instead of snapping back when
    // the parent re-renders with an old center.
    setMapCenter(payload.center)

    // Debounce the center/zoom used for querying toilets API to avoid excessive API calls
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

  const filteredToilets = showFreeOnly ? toilets.filter((t) => t.isFree) : toilets

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <header className="z-10 shrink-0 border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/icon.svg" width={46} height={46} alt="EuroLoo Logo" className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-black">EuroLoo</h1>
              <p className="hidden text-xs text-black/70 sm:block">Find nearby public toilets fast. Privacy-first by default.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <SignedOut>
                <Button variant="ghost" size="sm" onClick={openSignIn}>Sign In</Button>
              </SignedOut>
              <SignedIn>
                {user?.publicMetadata?.role === 'admin' && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href="/admin">Admin</a>
                  </Button>
                )}
                <UserButton />
              </SignedIn>
            </div>
            <Button 
                size="sm" 
                variant={isAddingToilet ? "destructive" : "secondary"} 
                className="gap-2"
                onClick={() => {
                   if (!user) {
                       toast("Help us keep EuroLoo clean", {
                           description: "Please sign in to add locations. We use accounts to prevent spam and ensure quality data for everyone.",
                           duration: 5000,
                       });
                       openSignIn();
                       return;
                   }

                   if (!userLocation) {
                       toast.info("Please enable location first", { description: "We need your location to let you add a toilet." })
                       handleUserLocationRequest()
                   } else {
                       const newState = !isAddingToilet
                       setIsAddingToilet(newState)
                       if (newState) {
                          setMapCenter(userLocation)
                          setZoom(18) // Close zoom for precise placement
                          toast("Tap the map to add a toilet")
                       }
                   }
                }}
            >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{isAddingToilet ? "Cancel" : "Add Missing"}</span>
            </Button>
            <Button
              variant={followMe ? "default" : "outline"}
              size="sm"
              onClick={handleUserLocationRequest}
              className="gap-2"
              aria-label="Follow my location"
              disabled={isLocating}
            >
              {isLocating ? (
                 <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                 <LocateFixed className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{isLocating ? "Locating..." : followMe ? "Following" : "Follow Me"}</span>
            </Button>
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
        </div>
      </header>

      {/* Main Content */}
      <main
        className="relative flex-1 min-h-0"
        onPointerDownCapture={() => {
          // The user is interacting with the map; don't auto-center from now on
          shouldAutoCenterRef.current = false
        }}
      >
        {isAddingToilet && (
            <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-black/10 bg-white px-4 py-2 shadow-lg animate-in fade-in slide-in-from-top-4">
                <p className="text-sm font-medium text-black">Tap within the circle to add toilet</p>
            </div>
        )}

        {error && (
          <div
            className="absolute left-1/2 top-16 z-[1000] -translate-x-1/2 rounded-lg border border-black/10 bg-white px-4 py-3 shadow-lg"
            role="alert"
          >
            <p className="text-sm font-medium text-black">{error}</p>
          </div>
        )}

        {!loading && !error && filteredToilets.length === 0 && (
          <div className="absolute left-1/2 top-16 z-[1000] -translate-x-1/2 rounded-lg border border-black/10 bg-white px-4 py-3 shadow-lg">
            <p className="text-sm font-medium text-black">No toilets found in this area yet.</p>
            <p className="mt-1 text-xs text-black/70">Move the map or zoom out, then try again.</p>
          </div>
        )}

        <MapContainer
          toilets={filteredToilets}
          loading={loading}
          onMarkerClick={setSelectedToilet}
          center={mapCenter}
          zoom={zoom}
          onBoundsChange={handleBoundsChange}
          onZoomChange={(z) => setZoom(z)}
          userLocation={userLocation}
          userHeading={userHeading}
          followMe={followMe}
          isSelectingLocation={isAddingToilet}
          onUserLocationRequest={handleUserLocationRequest}
          isLocating={isLocating}
          onLocationSelect={(latLng) => {
             if (!userLocation) return
             const d = getDistanceFromLatLonInMeters(userLocation[0], userLocation[1], latLng[0], latLng[1])
             if (d > 50) {
                 toast.error("Location too far", { description: "You must be within 50m of the toilet to add it." })
             } else {
                 setNewToiletLocation({ lat: latLng[0], lng: latLng[1] })
                 setDialogOpen(true)
                 setIsAddingToilet(false)
             }
          }}
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
      
      <AddToiletDialog 
         open={dialogOpen}
         onOpenChange={setDialogOpen}
         location={newToiletLocation}
         userLocation={userLocation ? { lat: userLocation[0], lng: userLocation[1] } : null}
      />
    </div>
  )
}

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // Radius of the earth in m
  const dLat = deg2rad(lat2-lat1);  
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in m
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180)
}
