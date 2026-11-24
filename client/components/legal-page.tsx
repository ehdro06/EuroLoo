import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SITE_CONFIG } from "@/lib/site-config"

// Shared layout for the privacy policy and terms pages

export function LegalPage({ title, lastUpdated, children }: { title: string; lastUpdated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-black/70 hover:text-black">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the map
        </Link>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-black">{title}</h1>
          <p className="text-sm text-black/70">Last updated {lastUpdated}</p>
        </header>

        {children}

        <nav aria-label="Legal" className="flex gap-4 border-t border-black/10 pt-6 text-sm text-black/70">
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
          <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link>
        </nav>
      </div>
    </main>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-black">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-black/80">{children}</div>
    </section>
  )
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>
}

// The operator's contact, as configured in lib/site-config.ts
export function ContactLink() {
  return SITE_CONFIG.contactEmail ? (
    <a className="underline" href={`mailto:${SITE_CONFIG.contactEmail}`}>
      {SITE_CONFIG.contactEmail}
    </a>
  ) : (
    <a className="underline" href={`${SITE_CONFIG.repositoryUrl}/issues`} target="_blank" rel="noreferrer">
      the project&apos;s GitHub page
    </a>
  )
}
