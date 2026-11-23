import { CLUSTER_MAX_ZOOM, createToiletIndex, mapItemsAt, zoomToExpand } from "./clusters"
import type { Toilet } from "@/lib/services/api"

const toilet = (id: number, lat: number, lon: number) => ({ id, lat, lon, name: `WC ${id}` }) as Toilet

// Five toilets within ~100 m in Berlin, one in Munich
const toilets = [
  toilet(1, 52.52, 13.405),
  toilet(2, 52.5203, 13.4053),
  toilet(3, 52.5206, 13.4048),
  toilet(4, 52.5198, 13.4056),
  toilet(5, 52.5201, 13.4044),
  toilet(6, 48.137, 11.575),
]

describe("clusters", () => {
  const index = createToiletIndex(toilets)

  it("groups close toilets into one bubble with a count when zoomed out", () => {
    const items = mapItemsAt(index, 10)
    const cluster = items.find((item) => item.kind === "cluster")
    expect(cluster).toMatchObject({ kind: "cluster", count: 5 })
    expect(items.filter((item) => item.kind === "toilet").map((item) => item.kind === "toilet" && item.toilet.id)).toEqual([6])
  })

  it("shows every toilet as its own pin when zoomed in far enough", () => {
    const items = mapItemsAt(index, CLUSTER_MAX_ZOOM + 1)
    expect(items).toHaveLength(6)
    expect(items.every((item) => item.kind === "toilet")).toBe(true)
  })

  it("zooms in further when a bubble is tapped", () => {
    const cluster = mapItemsAt(index, 10).find((item) => item.kind === "cluster")
    if (cluster?.kind !== "cluster") throw new Error("expected a cluster")
    const zoom = zoomToExpand(index, cluster.id)
    expect(zoom).toBeGreaterThan(10)
    expect(zoom).toBeLessThanOrEqual(CLUSTER_MAX_ZOOM + 1)
  })

  it("handles no toilets", () => {
    expect(mapItemsAt(createToiletIndex([]), 12)).toEqual([])
  })
})
