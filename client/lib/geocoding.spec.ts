import { mergeResults, searchPlaces, toPlace, zoomForPlaceType, type Place } from "./geocoding"

const place = (name: string, subtitle = "", id = `${name}|${subtitle}`): Place => ({ id, name, subtitle, lat: 0, lon: 0, zoom: 13 })
const photon = (...names: string[]) => ({
  features: names.map((name, i) => ({
    geometry: { coordinates: [i, i] },
    properties: { osm_type: "N", osm_id: name.length * 100 + i, name, type: "city" },
  })),
})

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

  it("keeps nearby results first but still shows well-known places elsewhere", () => {
    const nearby = [place("Londoner Straße", "Berlin")]
    const anywhere = [place("Londa", "Italy"), place("London", "United Kingdom"), place("London", "Canada")]
    expect(mergeResults(nearby, anywhere).map((p) => `${p.name} (${p.subtitle})`)).toEqual([
      "Londoner Straße (Berlin)",
      "Londa (Italy)",
      "London (United Kingdom)",
      "London (Canada)",
    ])
  })

  it("caps nearby results at 3, fills up to 6 and drops duplicates", () => {
    const nearby = ["A", "B", "C", "D", "E"].map((n) => place(n, "Berlin"))
    const anywhere = [place("A", "Berlin", "other-id"), place("X", "France"), place("Y", "Spain")]
    expect(mergeResults(nearby, anywhere).map((p) => p.name)).toEqual(["A", "B", "C", "X", "Y", "D"])
  })

  describe("searchPlaces", () => {
    const fetchMock = jest.fn()
    beforeEach(() => {
      fetchMock.mockReset()
      global.fetch = fetchMock as unknown as typeof fetch
    })
    const respond = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) })

    it("asks with and without the map location and merges both", async () => {
      fetchMock.mockImplementation((url: string) =>
        respond(url.includes("lat=") ? photon("Londoner Straße") : photon("London")),
      )
      const places = await searchPlaces("lond", [52.52, 13.405])
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(places.map((p) => p.name)).toEqual(["Londoner Straße", "London"])
    })

    it("still returns results when one of the two searches fails", async () => {
      fetchMock.mockImplementation((url: string) => (url.includes("lat=") ? respond({}, false) : respond(photon("London"))))
      await expect(searchPlaces("lond", [52.52, 13.405])).resolves.toHaveLength(1)
    })

    it("fails when both searches fail", async () => {
      fetchMock.mockImplementation(() => respond({}, false))
      await expect(searchPlaces("lond", [52.52, 13.405])).rejects.toThrow("Place search failed")
    })
  })
})
