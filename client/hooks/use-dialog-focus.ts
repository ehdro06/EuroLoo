"use client"

import { useEffect, useRef, type RefObject } from "react"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Open dialogs, innermost last; only the innermost one reacts to keys
const openDialogs: symbol[] = []

// Keyboard behaviour for our custom dialogs (toilet sheet, photo viewer, list):
// moves focus in when opened (to the element marked data-autofocus, if any), keeps
// Tab inside, closes on Escape, and returns focus to where it was when closed.
export function useDialogFocus(open: boolean, containerRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const container = containerRef.current
    if (!open || !container) return

    const id = Symbol("dialog")
    openDialogs.push(id)
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)
    const initial = container.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? container
    initial.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return
      // Leave keys alone in UI layered on top that isn't ours, e.g. Clerk's sign-in window
      const target = event.target as Node
      if (target !== document.body && !container.contains(target)) return
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab") return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || active === document.body)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      openDialogs.splice(openDialogs.indexOf(id), 1)
      // Return focus to the control that opened the dialog, if it still exists
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true })
    }
  }, [open, containerRef])
}
