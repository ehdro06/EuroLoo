import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    // The admin console is behind sign-in; keep it out of search results anyway
    rules: { userAgent: "*", allow: "/", disallow: "/admin" },
    sitemap: "https://euroloo.vercel.app/sitemap.xml",
  }
}
