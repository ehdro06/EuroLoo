"use client"

import { Accessibility, Baby, BadgeCheck, Euro, X, type LucideIcon } from "lucide-react"
import { countActiveFilters, FILTER_LABELS, NO_FILTERS, type ToiletFilters } from "@/lib/toilet-filters"

const FILTER_ICONS: Record<keyof ToiletFilters, LucideIcon> = {
  free: Euro,
  accessible: Accessibility,
  changingTable: Baby,
  verified: BadgeCheck,
}

interface MapFiltersProps {
  filters: ToiletFilters
  onChange: (filters: ToiletFilters) => void
  /** Drawn over the map: chips get a shadow so they read on any background */
  floating?: boolean
}

export function MapFilters({ filters, onChange, floating = false }: MapFiltersProps) {
  const activeCount = countActiveFilters(filters)

  return (
    <div className={`flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${floating ? "-mx-3 px-3 pb-2 sm:mx-0 sm:px-0" : "-mx-4 px-4"}`} role="group" aria-label="Filter toilets">
      {(Object.keys(FILTER_LABELS) as (keyof ToiletFilters)[]).map((key) => {
        const Icon = FILTER_ICONS[key]
        const active = filters[key]
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange({ ...filters, [key]: !active })}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors ${floating ? "shadow-sm" : ""} ${
              active ? "border-black bg-black text-white" : "border-black/15 bg-white text-black hover:bg-slate-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {FILTER_LABELS[key]}
          </button>
        )
      })}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange(NO_FILTERS)}
          aria-label="Clear filters"
          className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium text-black/70 hover:text-black ${floating ? "border border-black/10 bg-white shadow-sm" : ""}`}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  )
}
