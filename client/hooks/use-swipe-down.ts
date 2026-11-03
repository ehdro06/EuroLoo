"use client"

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

const CLOSE_DISTANCE_PX = 120
const CLOSE_VELOCITY_PX_PER_MS = 0.5
const ANIMATION_MS = 200

// Drag-down-to-dismiss for bottom sheets and viewers. Spread `handlers` on the
// drag area and apply `style` to the element that should follow the finger.
export function useSwipeDown(onClose: () => void) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ y: number; time: number } | null>(null)
  // Lets callers ignore the click that ends a drag
  const movedRef = useRef(false)

  const reset = () => {
    start.current = null
    setDragging(false)
  }

  const dismiss = useCallback(() => {
    // Slide out, then close and park the sheet back at 0 for the next open
    setOffset(window.innerHeight)
    window.setTimeout(() => {
      onClose()
      setOffset(0)
    }, ANIMATION_MS)
  }, [onClose])

  const handlers = {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      // Buttons inside the drag area keep working as buttons
      if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return
      start.current = { y: event.clientY, time: event.timeStamp }
      movedRef.current = false
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (!start.current) return
      const distance = Math.max(0, event.clientY - start.current.y)
      if (distance > 5) movedRef.current = true
      setOffset(distance)
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      if (!start.current) return
      const distance = Math.max(0, event.clientY - start.current.y)
      const velocity = distance / Math.max(1, event.timeStamp - start.current.time)
      reset()
      if (distance > CLOSE_DISTANCE_PX || (distance > 30 && velocity > CLOSE_VELOCITY_PX_PER_MS)) {
        dismiss()
      } else {
        setOffset(0)
      }
    },
    onPointerCancel() {
      reset()
      setOffset(0)
    },
  }

  const style = {
    transform: offset ? `translateY(${offset}px)` : undefined,
    transition: dragging ? "none" : `transform ${ANIMATION_MS}ms ease-out`,
  }

  // 1 when at rest, fading towards 0 as the element is dragged away
  const progress = Math.max(0, 1 - offset / 400)

  return { handlers, style, progress, dragging, dismiss, movedRef }
}
