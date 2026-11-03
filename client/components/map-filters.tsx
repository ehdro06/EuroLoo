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
}

export function MapFilters({ filters, onChange }: MapFiltersProps) {
  const activeCount = countActiveFilters(filters)

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter toilets">
      {(Object.keys(FILTER_LABELS) as (keyof ToiletFilters)[]).map((key) => {
        const Icon = FILTER_ICONS[key]
        const active = filters[key]
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange({ ...filters, [key]: !active })}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
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
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium text-black/60 hover:text-black"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  )
}
