"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { Loader2, MapPin, Search, X } from "lucide-react"
import { searchPlaces, type Place } from "@/lib/geocoding"

const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 300

interface PlaceSearchProps {
  // Results near this point are ranked higher
  near: [number, number]
  onSelect: (place: Place) => void
}

export function PlaceSearch({ near, onSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const listId = useId()

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      requestRef.current?.abort()
    },
    [],
  )

  const search = (value: string) => {
    setQuery(value)
    setError(null)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    requestRef.current?.abort()

    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }

    timerRef.current = window.setTimeout(async () => {
      const controller = new AbortController()
      requestRef.current = controller
      setLoading(true)
      try {
        const places = await searchPlaces(value.trim(), near, controller.signal)
        setResults(places)
        setActiveIndex(0)
        setOpen(true)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("Place search failed", err)
        setResults([])
        setError("Search is unavailable right now")
        setOpen(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)
  }

  const choose = (place: Place) => {
    setQuery(place.name)
    setOpen(false)
    // Hide the mobile keyboard so the map is visible
    inputRef.current?.blur()
    onSelect(place)
  }

  const clear = () => {
    search("")
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false)
      return
    }
    if (!open || results.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      choose(results[activeIndex])
    }
  }

  const showList = open && (results.length > 0 || error !== null || !loading)

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => search(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Search a city, station or address"
        aria-label="Search places"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        enterKeyHint="search"
        autoComplete="off"
        className="h-10 w-full rounded-full border border-black/10 bg-slate-50 pl-9 pr-10 text-sm text-black placeholder:text-black/40 focus:border-black/30 focus:bg-white focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
        {loading ? (
          <Loader2 className="m-1.5 h-4 w-4 animate-spin text-black/40" aria-label="Searching" />
        ) : (
          query && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="rounded-full p-1.5 text-black/40 hover:bg-black/5 hover:text-black"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          // Keep focus in the input so the click registers before onBlur closes the list
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-12 z-[1050] max-h-80 overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-xl"
        >
          {error ? (
            <li className="px-4 py-3 text-sm text-black/60">{error}</li>
          ) : results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-black/60">No places found</li>
          ) : (
            results.map((place, index) => (
              <li
                key={place.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => choose(place)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 ${index === activeIndex ? "bg-slate-100" : ""}`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-black/40" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-black">{place.name}</p>
                  {place.subtitle && <p className="truncate text-xs text-black/50">{place.subtitle}</p>}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
