import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SITE_CONFIG } from "@/lib/site-config"

export const metadata: Metadata = {
  title: "Privacy Policy – EuroLoo",
  description: "What data EuroLoo processes, why, and your rights.",
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-black">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-black/75">{children}</div>
    </section>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>
}

export default function PrivacyPage() {
  const contact = SITE_CONFIG.contactEmail ? (
    <a className="underline" href={`mailto:${SITE_CONFIG.contactEmail}`}>
      {SITE_CONFIG.contactEmail}
    </a>
  ) : (
    <a className="underline" href={`${SITE_CONFIG.repositoryUrl}/issues`} target="_blank" rel="noreferrer">
      the project&apos;s GitHub page
    </a>
  )

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-black/60 hover:text-black">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the map
        </Link>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-black">Privacy Policy</h1>
          <p className="text-sm text-black/60">Last updated {SITE_CONFIG.privacyLastUpdated}</p>
        </header>

        <Section title="In short">
          <List>
            <li>You can browse the map without an account.</li>
            <li>Your exact location stays in your browser unless you add a toilet, and even then it isn&apos;t stored.</li>
            <li>No advertising, no tracking cookies, no selling of data.</li>
            <li>If you sign in, we store your account details and what you contribute (reviews, photos, votes).</li>
          </List>
        </Section>

        <Section title="Who is responsible">
          <p>
            {SITE_CONFIG.name} is a non-commercial portfolio project
            {SITE_CONFIG.operatorName ? ` run by ${SITE_CONFIG.operatorName}` : ""}. For any privacy question or
            request, contact {contact}.
          </p>
        </Section>

        <Section title="What we process and why">
          <List>
            <li>
              <strong>Browsing the map.</strong> To show nearby toilets, your browser sends the centre of the area you&apos;re
              viewing to our server, rounded to about 10 km. Like any web server, it also sees your IP address in its request
              logs. Basis: our legitimate interest in providing the service (GDPR Art. 6(1)(f)).
            </li>
            <li>
              <strong>Your location</strong>, only if you allow it. It&apos;s used in your browser to centre the map and
              for &ldquo;Follow me&rdquo;. When you add a toilet, it&apos;s sent once to check you&apos;re within 50 m of
              it, and isn&apos;t saved. You can withdraw permission in your browser settings at any time. Basis: your
              consent (Art. 6(1)(a)).
            </li>
            <li>
              <strong>Your account.</strong> Sign-in is handled by Clerk. We store your email address, a display name
              (your username, or your first name and last initial) and your role. Basis: providing the service you signed
              up for (Art. 6(1)(b)).
            </li>
            <li>
              <strong>Your contributions.</strong> Reviews (rating, text, accessibility answers), photos, votes and
              toilets you add are stored with your account. Reviews and photos are public and show your display name.
            </li>
            <li>
              <strong>Place search.</strong> What you type into the search box is sent to Photon, a search service run by
              Komoot (Germany), to find matching places.
            </li>
            <li>
              <strong>Map images.</strong> Map tiles are loaded from OpenStreetMap&apos;s servers, which receive your IP
              address as part of each request.
            </li>
            <li>
              <strong>Usage statistics.</strong> Vercel Web Analytics counts page views without cookies and without
              identifying you.
            </li>
          </List>
        </Section>

        <Section title="Cookies and browser storage">
          <p>
            We don&apos;t use advertising or tracking cookies. When you sign in, Clerk sets cookies that are strictly
            necessary to keep you signed in. We also keep a list of the toilets you voted on in your browser&apos;s local
            storage, so the vote buttons aren&apos;t shown again; it never leaves your device.
          </p>
        </Section>

        <Section title="Service providers">
          <p>These companies process data on our behalf to run EuroLoo:</p>
          <List>
            <li>Vercel: hosts the website and provides the usage statistics.</li>
            <li>Google Cloud: runs our API and stores photos, in the europe-west1 region (Belgium).</li>
            <li>Neon: hosts our database.</li>
            <li>Clerk: handles sign-in and account management; may process data outside the EU.</li>
            <li>Komoot (Photon) and the OpenStreetMap Foundation: place search and map tiles, as described above.</li>
          </List>
        </Section>

        <Section title="How long we keep data">
          <p>
            Account data and contributions are kept until you delete them or ask us to. You can delete your own photos
            in the app. Server logs are kept for a limited period by our hosting providers.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under the GDPR you can ask to access, correct, delete or export your data, restrict or object to its
            processing, and withdraw consent at any time. To do so, contact {contact}. You also have the right to
            complain to a data protection authority in your country.
          </p>
        </Section>

        <Section title="Open data">
          <p>
            Toilet locations come from{" "}
            <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>{" "}
            © OpenStreetMap contributors, available under the Open Database License.
          </p>
        </Section>
      </div>
    </main>
  )
}
