// Pin colors (Tailwind green-700 / amber-700 / gray-600) keep at least 3:1 contrast
// against every map background (land, roads, parks, water), as WCAG 1.4.11
// requires for meaningful graphics. Free/paid is also shown in text in the details.
export const PIN_COLORS = { free: "#15803d", paid: "#b45309", unknown: "#4b5563" } as const

// Grouped toilets and the visitor's own position, as drawn on the map
export const CLUSTER_COLOR = "#1f2937" // gray-800
export const USER_DOT_COLOR = "#0ea5e9" // sky-500
