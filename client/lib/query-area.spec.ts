import { coversView, planQueryArea } from "./query-area"

describe("planQueryArea", () => {
  it("covers the view even when the center is far from a round number", () => {
    // Central Paris: rounding to 1 decimal used to shift the circle ~5km away
    const center: [number, number] = [48.8566, 2.3522]
    const viewRadius = 1500
    const area = planQueryArea(center, viewRadius)

    expect(area).toMatchObject({ lat: 48.86, lng: 2.35 })
    expect(coversView(area, center, viewRadius)).toBe(true)
  })

  it("uses a minimum radius and a multiple of 100m", () => {
    const area = planQueryArea([52.52, 13.405], 800)
    expect(area.radius).toBeGreaterThanOrEqual(5000)
    expect(area.radius % 100).toBe(0)
  })
})

describe("coversView", () => {
  const area = { lat: 52.5, lng: 13.4, radius: 5000 }

  it("is true for a view inside the fetched circle", () => {
    expect(coversView(area, [52.5, 13.4], 2000)).toBe(true)
  })

  it("is false once the view reaches past the circle's edge", () => {
    // ~4.4km north plus a 2km view radius exceeds 5km
    expect(coversView(area, [52.54, 13.4], 2000)).toBe(false)
  })
})
