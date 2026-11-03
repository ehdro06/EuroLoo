"use client"

import { useEffect } from "react"
import { Loader2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ImageRecord } from "@/lib/services/api"

interface ImageLightboxProps {
  image: ImageRecord
  canDelete: boolean
  isDeleting: boolean
  onDelete: () => void
  onClose: () => void
}

// Full-screen photo viewer. Rendered above the toilet drawer (z-[1002]),
// which is why it doesn't use the shared Dialog component (z-50).
export function ImageLightbox({ image, canDelete, isDeleting, onDelete, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1100] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-2 p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="truncate text-sm">
          {image.user?.username ? `By ${image.user.username}` : "Photo"}
          {" · "}
          {new Date(image.createdAt).toLocaleDateString()}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={isDeleting} className="gap-2">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close photo"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        {/* External GCS URL; Next image optimization is disabled for this app */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.user?.username ? `Photo by ${image.user.username}` : "Toilet photo"}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
