"use client"

import { MapPin, Euro, Clock, Accessibility, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Toilet } from "@/hooks/use-overpass"

interface ToiletDrawerProps {
  toilet: Toilet | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ToiletDrawer({ toilet, open, onOpenChange }: ToiletDrawerProps) {
  if (!open || !toilet) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[1001] bg-black/40" onClick={() => onOpenChange(false)} aria-hidden="true" />

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[1002] rounded-t-2xl border-t border-black/10 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="mx-auto max-w-2xl p-6">
          {/* Handle */}
          <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-black/20" />

          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 id="drawer-title" className="text-2xl font-semibold tracking-tight text-black">
                {toilet.name || "Public Toilet"}
              </h2>
              {toilet.operator && <p className="mt-1 text-sm text-black/60">Operated by {toilet.operator}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close details">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {/* Fee */}
            <div className="flex items-center gap-3">
              <Euro className="h-5 w-5 text-black/60" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-black">Fee</p>
                <p
                  className={`text-sm font-semibold ${
                    toilet.isFree ? "text-green-600" : toilet.isPaid ? "text-amber-600" : "text-black/60"
                  }`}
                >
                  {toilet.isFree
                    ? "Free"
                    : toilet.isPaid
                      ? toilet.fee === "yes"
                        ? "Paid (Sanifair)"
                        : `Paid (${toilet.fee})`
                      : "Unknown"}
                </p>
              </div>
            </div>

            {/* Opening Hours */}
            {toilet.openingHours && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-black/60" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-black">Opening Hours</p>
                  <p className="text-sm text-black/60">{toilet.openingHours}</p>
                </div>
              </div>
            )}

            {/* Accessibility */}
            <div className="flex items-center gap-3">
              <Accessibility className="h-5 w-5 text-black/60" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-black">Accessibility</p>
                <p className={`text-sm font-semibold ${toilet.isAccessible ? "text-green-600" : "text-black/60"}`}>
                  {toilet.isAccessible ? "Wheelchair Accessible" : toilet.wheelchair ? toilet.wheelchair : "Unknown"}
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-black/60" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-black">Coordinates</p>
                <p className="text-sm text-black/60">
                  {toilet.lat.toFixed(5)}, {toilet.lon.toFixed(5)}
                </p>
              </div>
            </div>
          </div>

          {/* Directions Button */}
          <Button className="mt-6 w-full" asChild>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get directions to this toilet"
            >
              Get Directions
            </a>
          </Button>
        </div>
      </div>
    </>
  )
}
