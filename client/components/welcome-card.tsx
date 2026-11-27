"use client"

import Image from "next/image"
import { ShieldCheck } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { LegendItems } from "@/components/map-legend"
import { APP_LOGO, APP_NAME, APP_TAGLINE } from "@/lib/brand"

const SEEN_KEY = "euroloo_welcome_seen"

/** True on a visitor's first visit; storage can be blocked, so fail towards not nagging. */
export function isFirstVisit(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === null
  } catch {
    return false
  }
}

function rememberSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1")
  } catch {
    // Private mode or blocked storage: the card may show again next time
  }
}

/** What the site is and how to read the map. Shown once, then from the menu's "About". */
export function WelcomeCard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const change = (next: boolean) => {
    if (!next) rememberSeen()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-w-sm gap-0 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Image src={APP_LOGO} width={46} height={46} alt="" className="h-11 w-11" />
          <DialogTitle className="text-xl font-semibold text-black">{APP_NAME}</DialogTitle>
        </div>
        <DialogDescription className="mt-3 text-base text-black">{APP_TAGLINE}, including wheelchair-accessible ones and baby-changing tables.</DialogDescription>

        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-black">On the map</p>
          <LegendItems />
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-black/70">
          <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
          No tracking. Your exact location stays in your browser. Map data from OpenStreetMap.
        </p>

        <DialogClose className="mt-5 h-11 w-full rounded-full bg-black text-sm font-semibold text-white hover:bg-black/85">
          Got it
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
