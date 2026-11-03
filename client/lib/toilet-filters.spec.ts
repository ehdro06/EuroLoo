import { applyToiletFilters, countActiveFilters, NO_FILTERS } from "./toilet-filters"
import type { Toilet } from "@/lib/services/api"

const toilet = (id: number, overrides: Partial<Toilet>): Toilet => ({
  id,
  externalId: `node/${id}`,
  lat: 0,
  lon: 0,
  isFree: false,
  isPaid: false,
  isAccessible: false,
  ...overrides,
})

const toilets = [
  toilet(1, { isFree: true, isAccessible: true, hasChangingTable: true, isVerified: true }),
  toilet(2, { isFree: true }),
  toilet(3, { isAccessible: true, isVerified: true }),
]

describe("applyToiletFilters", () => {
  it("returns everything without filters", () => {
    expect(applyToiletFilters(toilets, NO_FILTERS)).toHaveLength(3)
  })

  it("combines active filters with AND", () => {
    const ids = (f: Partial<typeof NO_FILTERS>) => applyToiletFilters(toilets, { ...NO_FILTERS, ...f }).map((t) => t.id)
    expect(ids({ free: true })).toEqual([1, 2])
    expect(ids({ accessible: true })).toEqual([1, 3])
    expect(ids({ free: true, accessible: true })).toEqual([1])
    expect(ids({ changingTable: true, verified: true })).toEqual([1])
  })

  it("counts active filters", () => {
    expect(countActiveFilters({ ...NO_FILTERS, free: true, verified: true })).toBe(2)
  })
})
