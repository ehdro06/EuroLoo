import { toiletLabel } from "./toilet-label"

describe("toiletLabel", () => {
  it("names the toilet and its key facts", () => {
    expect(toiletLabel({ name: "Alexanderplatz", isFree: true, isPaid: false, isAccessible: true, hasChangingTable: true })).toBe(
      "Toilet: Alexanderplatz. Free, wheelchair accessible, baby changing",
    )
  })

  it("works without a name or extras", () => {
    expect(toiletLabel({ isFree: false, isPaid: true, isAccessible: false })).toBe("Toilet. Paid")
    expect(toiletLabel({ isFree: false, isPaid: false, isAccessible: false })).toBe("Toilet. Price unknown")
  })
})
