// Groups nearby toilets into numbered bubbles when the map is zoomed out, so a
// city view shows a handful of bubbles instead of hundreds of overlapping pins.

import Supercluster from "supercluster"
import type { Toilet } from "@/lib/services/api"

// From this zoom on, every toilet gets its own pin
export const CLUSTER_MAX_ZOOM = 15
// Pins closer than about 60 screen pixels are grouped. Supercluster measures the radius
// on 512-px tiles and the map uses 256-px tiles, hence twice the screen distance.
const CLUSTER_RADIUS = 120
const WHOLE_WORLD: [number, number, number, number] = [-180, -85, 180, 85]

export type ToiletIndex = Supercluster<{ toilet: Toilet }, Record<string, never>>

export type MapItem =
  | { kind: "toilet"; toilet: Toilet }
  | { kind: "cluster"; id: number; lat: number; lon: number; count: number }

export function createToiletIndex(toilets: Toilet[]): ToiletIndex {
  const index: ToiletIndex = new Supercluster({ radius: CLUSTER_RADIUS, maxZoom: CLUSTER_MAX_ZOOM })
  return index.load(
    toilets.map((toilet) => ({
      type: "Feature" as const,
      // GeoJSON order is [lon, lat]
      geometry: { type: "Point" as const, coordinates: [toilet.lon, toilet.lat] },
      properties: { toilet },
    })),
  )
}

// What to draw at this zoom: single toilets and bubbles. The loaded toilets only cover
// the area around the view, so asking for the whole world stays cheap.
export function mapItemsAt(index: ToiletIndex, zoom: number): MapItem[] {
  return index.getClusters(WHOLE_WORLD, Math.floor(zoom)).map((feature) => {
    const [lon, lat] = feature.geometry.coordinates
    if ("cluster" in feature.properties && feature.properties.cluster) {
      return { kind: "cluster", id: feature.properties.cluster_id, lat, lon, count: feature.properties.point_count }
    }
    return { kind: "toilet", toilet: (feature.properties as { toilet: Toilet }).toilet }
  })
}

// Tapping a bubble zooms in just far enough for it to split up
export function zoomToExpand(index: ToiletIndex, clusterId: number): number {
  return Math.min(index.getClusterExpansionZoom(clusterId), CLUSTER_MAX_ZOOM + 1)
}
