import type { Toilet } from "@/lib/services/api"

/** What a screen reader announces for a toilet's map pin, e.g. "Toilet: Alexanderplatz. Free, wheelchair accessible". */
export function toiletLabel(toilet: Pick<Toilet, "name" | "isFree" | "isPaid" | "isAccessible" | "hasChangingTable">): string {
  const facts = [
    toilet.isFree ? "free" : toilet.isPaid ? "paid" : "price unknown",
    toilet.isAccessible && "wheelchair accessible",
    toilet.hasChangingTable && "baby changing",
  ].filter(Boolean) as string[]
  const sentence = facts.join(", ")
  return `Toilet${toilet.name ? `: ${toilet.name}` : ""}. ${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`
}
