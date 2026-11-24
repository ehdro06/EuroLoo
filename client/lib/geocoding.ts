// Place search via Photon (https://photon.komoot.io), an OpenStreetMap-based geocoder.
// Called straight from the browser; queries are debounced by the caller.

const PHOTON_URL = "https://photon.komoot.io/api/"

export interface Place {
  id: string
  name: string
  // e.g. "Paris, France"
  subtitle: string
  lat: number
  lon: number
  zoom: number
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type?: string
    osm_id?: number
    name?: string
    street?: string
    housenumber?: string
    city?: string
    state?: string
    country?: string
    type?: string
  }
}

// How far to zoom in depending on what kind of place was picked
const ZOOM_BY_TYPE: Record<string, number> = {
  country: 6,
  state: 8,
  county: 10,
  city: 13,
  district: 14,
  locality: 14,
  street: 16,
  house: 17,
}
const DEFAULT_ZOOM = 15

export function zoomForPlaceType(type: string | undefined): number {
  return (type && ZOOM_BY_TYPE[type]) || DEFAULT_ZOOM
}

export function toPlace(feature: PhotonFeature): Place | null {
  const p = feature.properties
  const [lon, lat] = feature.geometry.coordinates
  const name = p.name ?? (p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : undefined)
  if (!name) return null

  // Skip parts already in the name (searching "Paris" shouldn't say "Paris, Paris, France")
  const subtitle = [p.city, p.state, p.country].filter((part) => part && part !== name)
  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? `${lat},${lon}`}`,
    name,
    subtitle: [...new Set(subtitle)].join(", "),
    lat,
    lon,
    zoom: zoomForPlaceType(p.type),
  }
}

const MAX_RESULTS = 6
// How many of the results may come from the location-biased search. Photon weighs
// distance so strongly that, near Berlin, "lond" only returns Londoner Straße; the
// rest of the list is filled from an unbiased search, so London still shows up.
const MAX_NEARBY_RESULTS = 3

async function fetchPlaces(params: URLSearchParams, signal?: AbortSignal): Promise<Place[]> {
  const response = await fetch(`${PHOTON_URL}?${params}`, { signal })
  if (!response.ok) throw new Error(`Place search failed (${response.status})`)
  const body = (await response.json()) as { features?: PhotonFeature[] }
  return (body.features ?? []).map(toPlace).filter((place): place is Place => place !== null)
}

// Nearby results first, then well-known places from anywhere, without duplicates.
// Photon can also return the same place more than once (e.g. a station and its platform).
export function mergeResults(nearby: Place[], anywhere: Place[]): Place[] {
  const seen = new Set<string>()
  const unique = (place: Place) => {
    const key = `${place.name}|${place.subtitle}`
    if (seen.has(key) || seen.has(place.id)) return false
    seen.add(key)
    seen.add(place.id)
    return true
  }
  const merged: Place[] = []
  for (const place of nearby) {
    if (merged.length >= MAX_NEARBY_RESULTS) break
    if (unique(place)) merged.push(place)
  }
  for (const place of [...anywhere, ...nearby]) {
    if (merged.length >= MAX_RESULTS) break
    if (unique(place)) merged.push(place)
  }
  return merged
}

export async function searchPlaces(
  query: string,
  near: [number, number] | null,
  signal?: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: String(MAX_RESULTS), lang: "en" })
  if (!near) return mergeResults([], await fetchPlaces(params, signal))

  // Ask twice in parallel: once preferring places near what the user is looking at,
  // once without a location
  const nearParams = new URLSearchParams(params)
  nearParams.set("lat", near[0].toFixed(4))
  nearParams.set("lon", near[1].toFixed(4))
  const [nearby, anywhere] = await Promise.allSettled([fetchPlaces(nearParams, signal), fetchPlaces(params, signal)])

  // One failed search still gives usable results
  if (nearby.status === "rejected" && anywhere.status === "rejected") throw nearby.reason
  return mergeResults(
    nearby.status === "fulfilled" ? nearby.value : [],
    anywhere.status === "fulfilled" ? anywhere.value : [],
  )
}
