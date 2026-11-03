import type { Toilet } from "@/lib/services/api"

export interface ToiletFilters {
  free: boolean
  accessible: boolean
  changingTable: boolean
  verified: boolean
}

export const NO_FILTERS: ToiletFilters = { free: false, accessible: false, changingTable: false, verified: false }

export const FILTER_LABELS: Record<keyof ToiletFilters, string> = {
  free: "Free",
  accessible: "Wheelchair",
  changingTable: "Changing table",
  verified: "Verified",
}

export function countActiveFilters(filters: ToiletFilters): number {
  return Object.values(filters).filter(Boolean).length
}

// Each active filter must match (AND). Uses the map data (OpenStreetMap plus votes).
export function applyToiletFilters(toilets: Toilet[], filters: ToiletFilters): Toilet[] {
  return toilets.filter(
    (t) =>
      (!filters.free || t.isFree) &&
      (!filters.accessible || t.isAccessible) &&
      (!filters.changingTable || t.hasChangingTable === true) &&
      (!filters.verified || t.isVerified === true),
  )
}
