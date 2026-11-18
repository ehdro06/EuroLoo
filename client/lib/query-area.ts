// Decides which circle of toilets to fetch for the current map view.

export interface QueryArea {
  lat: number
  lng: number
  radius: number
}

// Fetch at least this far around the view so small pans don't refetch
export const MIN_FETCH_RADIUS_METERS = 5000

export function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// The center is rounded to 2 decimals (~1 km) so nearby views share the same
// request (and server cache entry). The radius is grown by the rounding offset,
// so the rounded circle still covers the whole view.
export function planQueryArea(center: [number, number], viewRadius: number): QueryArea {
  const lat = Number(center[0].toFixed(2))
  const lng = Number(center[1].toFixed(2))
  const roundingOffset = distanceInMeters(center[0], center[1], lat, lng)
  const radius = Math.ceil((Math.max(viewRadius, MIN_FETCH_RADIUS_METERS) + roundingOffset) / 100) * 100
  return { lat, lng, radius }
}

// True if the already-fetched area fully covers a view of `viewRadius` around `center`
export function coversView(area: QueryArea, center: [number, number], viewRadius: number): boolean {
  return distanceInMeters(center[0], center[1], area.lat, area.lng) + viewRadius <= area.radius
}
