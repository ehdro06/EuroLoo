// Map background tiles. The map library's default is the public OpenStreetMap tile server,
// which is volunteer-run, slow at times and not meant for apps. CARTO's basemaps keep
// OpenStreetMap's data but are served from a CDN, with a sharp @2x version.
// CARTO needs a free API key (non-commercial use, restricted to our domain); without one
// its tiles are watermarked, so we stay on OpenStreetMap's tiles until the key is set.
const SUBDOMAINS = ["a", "b", "c", "d"]

export type TileProvider = (x: number, y: number, z: number, dpr?: number) => string

export function osmTiles(x: number, y: number, z: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
}

/** CARTO Voyager raster tiles for the given key: @2x on high-density screens. */
export function cartoVoyager(apiKey: string): TileProvider {
  return (x, y, z, dpr = 1) => {
    // Spread requests over the four hosts so browsers fetch more tiles at once
    const host = SUBDOMAINS[Math.abs(x + y) % SUBDOMAINS.length]
    const retina = dpr >= 2 ? "@2x" : ""
    return `https://${host}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}${retina}.png?key=${encodeURIComponent(apiKey)}`
  }
}

/** The tile source for this deployment, and whether it is CARTO (for the attribution). */
export function pickTiles(apiKey: string | undefined): { provider: TileProvider; carto: boolean } {
  const key = apiKey?.trim()
  return key ? { provider: cartoVoyager(key), carto: true } : { provider: osmTiles, carto: false }
}

// Close to the map's land colour, so tiles still loading show as a quiet blank
// instead of grey squares
export const TILE_BACKGROUND = "#f2efe9"
