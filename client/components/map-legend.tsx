"use client"

import { useEffect, useRef, useState } from "react"
import { Info, X } from "lucide-react"
import { CLUSTER_COLOR, PIN_COLORS, USER_DOT_COLOR } from "@/lib/pins"

function Pin({ color }: { color: string }) {
  return (
    <svg width={20} height={24} viewBox="0 0 61 71" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M52 31.5C52 36.8395 49.18 42.314 45.0107 47.6094C40.8672 52.872 35.619 57.678 31.1763 61.6922C30.7916 62.0398 30.2084 62.0398 29.8237 61.6922C25.381 57.678 20.1328 52.872 15.9893 47.6094C11.82 42.314 9 36.8395 9 31.5C9 18.5709 18.6801 9 30.5 9C42.3199 9 52 18.5709 52 31.5Z"
        fill={color}
        stroke="white"
        strokeWidth="4"
      />
      <circle cx="30.5" cy="30.5" r="8.5" fill="white" opacity="0.6" />
    </svg>
  )
}

/** What each mark on the map means. Used in the welcome card and the legend button. */
export function LegendItems() {
  const item = "flex items-center gap-3 text-sm text-black"
  return (
    <ul className="space-y-2.5">
      <li className={item}>
        <Pin color={PIN_COLORS.free} /> Free
      </li>
      <li className={item}>
        <Pin color={PIN_COLORS.paid} /> Paid
      </li>
      <li className={item}>
        <Pin color={PIN_COLORS.unknown} /> Price unknown
      </li>
      <li className={item}>
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow"
          style={{ background: CLUSTER_COLOR }}
          aria-hidden="true"
        >
          5
        </span>
        Several toilets: tap to zoom in
      </li>
      <li className={item}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ background: USER_DOT_COLOR }} />
        </span>
        You, once you share your location
      </li>
    </ul>
  )
}

/** A small "map key" button with a card above it. Escape or the button closes it. */
export function LegendButton() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="relative">
      {open && (
        <div
          id="map-legend"
          role="region"
          aria-label="Map key"
          className="absolute bottom-14 left-0 w-64 rounded-2xl border border-black/10 bg-white p-4 shadow-xl"
        >
          <p className="mb-3 text-sm font-semibold text-black">Map key</p>
          <LegendItems />
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="map-legend"
        aria-label={open ? "Hide map key" : "Show map key"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-md hover:bg-slate-50"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Info className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  )
}
