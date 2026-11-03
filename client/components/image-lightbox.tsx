"use client"

import { useEffect } from "react"
import { Loader2, Trash2, X } from "lucide-react"
import type { ImageRecord } from "@/lib/services/api"
import { useSwipeDown } from "@/hooks/use-swipe-down"

interface ImageLightboxProps {
  image: ImageRecord
  canDelete: boolean
  isDeleting: boolean
  onDelete: () => void
  onClose: () => void
}

// Both toolbar buttons share this shape so they line up
const toolbarButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/10 text-sm font-medium text-white backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60"

// Full-screen photo viewer. Rendered above the toilet drawer (z-[1002]),
// which is why it doesn't use the shared Dialog component (z-50).
export function ImageLightbox({ image, canDelete, isDeleting, onDelete, onClose }: ImageLightboxProps) {
  const swipe = useSwipeDown(onClose)
  const { dismiss } = swipe

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dismiss])

  const uploadedOn = new Date(image.createdAt).toLocaleDateString()

  return (
    <div
      className="fixed inset-0 z-[1100] flex touch-none select-none flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      {...swipe.handlers}
      onClick={() => {
        // A drag that ends on the background shouldn't count as a tap
        if (!swipe.movedRef.current) dismiss()
      }}
    >
      <div className="absolute inset-0 bg-black/95" style={{ opacity: swipe.progress }} aria-hidden="true" />

      <div className="relative flex flex-1 flex-col" style={swipe.style}>
        {/* Toolbar */}
        <div
          className="flex items-center gap-3 px-4 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0 flex-1 text-white">
            <p className="truncate text-sm font-medium">{image.user?.username ? image.user.username : "Photo"}</p>
            <p className="text-xs text-white/60">{uploadedOn}</p>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className={`${toolbarButton} px-4 hover:bg-red-600`}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
          )}
          <button type="button" onClick={dismiss} aria-label="Close photo" className={`${toolbarButton} w-10 hover:bg-white/20`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Handle hint: drag anywhere to close */}
        <div className="mx-auto h-1.5 w-12 rounded-full bg-white/40" aria-hidden="true" />

        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          {/* External GCS URL; Next image optimization is disabled for this app */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.user?.username ? `Photo by ${image.user.username}` : "Toilet photo"}
            className="max-h-full max-w-full rounded-lg object-contain"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  )
}
