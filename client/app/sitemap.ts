import type { MetadataRoute } from "next"

const SITE = "https://euroloo.vercel.app"

// Public pages only. City pages will be listed here once they exist.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ]
}
