import { cartoVoyager, osmTiles, pickTiles } from "./map-tiles"

describe("cartoVoyager", () => {
  const tiles = cartoVoyager("k3y")

  it("builds a Voyager tile URL with the key", () => {
    expect(tiles(1, 2, 3)).toBe("https://d.basemaps.cartocdn.com/rastertiles/voyager/3/1/2.png?key=k3y")
  })

  it("asks for @2x tiles on high-density screens", () => {
    expect(tiles(1, 2, 3, 2)).toBe("https://d.basemaps.cartocdn.com/rastertiles/voyager/3/1/2@2x.png?key=k3y")
  })

  it("spreads tiles across the four hosts", () => {
    const hosts = [0, 1, 2, 3].map((x) => new URL(tiles(x, 0, 5)).host.charAt(0))
    expect(hosts).toEqual(["a", "b", "c", "d"])
  })
})

describe("pickTiles", () => {
  it("uses CARTO when a key is set", () => {
    const picked = pickTiles("abc")
    expect(picked.carto).toBe(true)
    expect(picked.provider(0, 0, 1)).toContain("basemaps.cartocdn.com")
  })

  it("stays on OpenStreetMap without a key, so tiles are never watermarked", () => {
    for (const key of [undefined, "", "  "]) {
      const picked = pickTiles(key)
      expect(picked.carto).toBe(false)
      expect(picked.provider(1, 2, 3)).toBe(osmTiles(1, 2, 3))
    }
  })
})
