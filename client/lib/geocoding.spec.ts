import { toPlace, zoomForPlaceType } from "./geocoding"

describe("geocoding", () => {
  it("zooms in further for smaller places", () => {
    expect(zoomForPlaceType("country")).toBeLessThan(zoomForPlaceType("city"))
    expect(zoomForPlaceType("city")).toBeLessThan(zoomForPlaceType("house"))
    expect(zoomForPlaceType(undefined)).toBe(15)
  })

  it("builds a readable place without repeating the name", () => {
    const place = toPlace({
      geometry: { coordinates: [2.3522, 48.8566] },
      properties: { osm_type: "R", osm_id: 7444, name: "Paris", city: "Paris", country: "France", type: "city" },
    })
    expect(place).toEqual({ id: "R7444", name: "Paris", subtitle: "France", lat: 48.8566, lon: 2.3522, zoom: 13 })
  })

  it("falls back to the street for unnamed addresses and skips nameless results", () => {
    expect(
      toPlace({ geometry: { coordinates: [0, 0] }, properties: { street: "Rue de Rivoli", housenumber: "1" } })?.name,
    ).toBe("Rue de Rivoli 1")
    expect(toPlace({ geometry: { coordinates: [0, 0] }, properties: {} })).toBeNull()
  })
})
