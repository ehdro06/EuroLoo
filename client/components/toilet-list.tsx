"use client"

import { useMemo, useRef } from "react"
import { Accessibility, Baby, X } from "lucide-react"
import type { Toilet } from "@/lib/services/api"
import { distanceInMeters } from "@/lib/query-area"
import { useDialogFocus } from "@/hooks/use-dialog-focus"

const MAX_ITEMS = 30

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`
}

interface ToiletListProps {
  toilets: Toilet[]
  // Distances are measured from here (the map center)
  center: [number, number]
  filtersActive: boolean
  onSelect: (toilet: Toilet) => void
  onClose: () => void
}

// Keyboard- and screen-reader-friendly alternative to the map pins
export function ToiletList({ toilets, center, filtersActive, onSelect, onClose }: ToiletListProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogFocus(true, panelRef, onClose)

  const nearest = useMemo(
    () =>
      toilets
        .map((toilet) => ({ toilet, distance: distanceInMeters(center[0], center[1], toilet.lat, toilet.lon) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_ITEMS),
    [toilets, center],
  )

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="toilet-list-title"
      tabIndex={-1}
      className="absolute inset-x-3 bottom-3 top-3 z-[1001] flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl sm:right-auto sm:w-96"
    >
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
        <h2 id="toilet-list-title" className="text-base font-semibold text-black">
          Nearest toilets
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close list"
          className="rounded-full p-2 text-black/70 hover:bg-black/5 hover:text-black"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {nearest.length === 0 ? (
        <p className="px-4 py-6 text-sm text-black/70">
          {filtersActive ? "No toilets here match your filters." : "No toilets in this area. Move the map or zoom out."}
        </p>
      ) : (
        <ul className="flex-1 divide-y divide-black/5 overflow-y-auto">
          {nearest.map(({ toilet, distance }) => (
            <li key={toilet.id}>
              <button
                type="button"
                onClick={() => onSelect(toilet)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-black">{toilet.name || "Public toilet"}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-black/70">
                    <span>{toilet.isFree ? "Free" : toilet.isPaid ? "Paid" : "Fee unknown"}</span>
                    {toilet.isAccessible && (
                      <span className="inline-flex items-center gap-0.5">
                        <Accessibility className="h-3 w-3" aria-hidden="true" />
                        Wheelchair
                      </span>
                    )}
                    {toilet.hasChangingTable && (
                      <span className="inline-flex items-center gap-0.5">
                        <Baby className="h-3 w-3" aria-hidden="true" />
                        Changing table
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-black/70">{formatDistance(distance)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
