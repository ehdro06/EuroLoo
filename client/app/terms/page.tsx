import type { Metadata } from "next"
import Link from "next/link"
import { ContactLink, LegalPage, List, Section } from "@/components/legal-page"
import { SITE_CONFIG } from "@/lib/site-config"

export const metadata: Metadata = {
  title: "Terms of Service – EuroLoo",
  description: "The rules for using EuroLoo and contributing reviews and photos.",
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated={SITE_CONFIG.termsLastUpdated}>
      <Section title="In short">
        <List>
          <li>EuroLoo is a free, non-commercial portfolio project. There are no payments, ads or subscriptions.</li>
          <li>Toilet information can be wrong or out of date. Please check on site.</li>
          <li>Only post your own photos and honest reviews, and keep people and licence plates out of photos.</li>
          <li>You keep ownership of what you post; you let us show it in the app.</li>
        </List>
      </Section>

      <Section title="Who runs EuroLoo">
        <p>
          {SITE_CONFIG.name} is run by {SITE_CONFIG.operatorName ?? "its developer"} as a personal portfolio project. Questions
          about these terms: <ContactLink />.
        </p>
      </Section>

      <Section title="Accounts">
        <p>
          You can browse the map without an account. To add reviews, photos, votes or toilets you need an account, and
          you must be at least 16 years old. You&apos;re responsible for what is posted from your account.
        </p>
      </Section>

      <Section title="What you may post">
        <p>Reviews, photos, votes and new toilets should help other people find a toilet. Please don&apos;t post:</p>
        <List>
          <li>photos you didn&apos;t take yourself, or that you don&apos;t have the right to share;</li>
          <li>photos showing people&apos;s faces or other identifiable people, licence plates, or other personal details;</li>
          <li>offensive, hateful, sexual, threatening or illegal content;</li>
          <li>false or misleading information, such as fake reviews or toilets that don&apos;t exist;</li>
          <li>advertising, spam, or anything posted automatically by scripts.</li>
        </List>
        <p>
          Photos are cleaned before they&apos;re published: location data and other hidden information (EXIF metadata)
          are removed.
        </p>
      </Section>

      <Section title="Your content and our licence">
        <p>
          You keep ownership of your reviews and photos. By posting them, you give {SITE_CONFIG.name} a free,
          non-exclusive permission to store, resize and show them in the app, worldwide, for as long as they&apos;re
          published. The permission ends when you delete them or your account (copies in short-lived backups or caches
          may take a little longer to disappear). You confirm you have the right to post what you upload.
        </p>
      </Section>

      <Section title="Moderation">
        <p>
          Anyone can report a toilet that doesn&apos;t exist; enough reports hide it automatically, and an admin can review
          it. We may remove content or suspend or delete accounts that break these terms, without notice. To report a
          problem with a review or photo, contact <ContactLink />.
        </p>
      </Section>

      <Section title="Toilet information">
        <p>
          Toilet locations come from{" "}
          <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{" "}
          contributors and from EuroLoo users. We can&apos;t check every entry, so a toilet may be missing, closed,
          not free, or not accessible even if the app says otherwise. Use the information at your own judgement.
        </p>
      </Section>

      <Section title="No warranty">
        <p>
          EuroLoo is provided for free and &ldquo;as is&rdquo;, without any guarantee that it is accurate, complete or
          always available, and it may change or shut down at any time. We&apos;re not responsible for losses caused by
          relying on it, except where the law doesn&apos;t allow this to be limited (for example, for intent, gross
          negligence, or injury).
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          You can delete your account at any time from the account menu (your profile picture, then Manage account,
          then Delete account). This removes your reviews, photos and votes; toilets you added stay on the map without
          your name. See the <Link className="underline" href="/privacy">Privacy Policy</Link> for how your data is
          handled.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these terms; the date at the top shows the latest version. If a change matters, we&apos;ll point
          it out in the app. Continuing to use EuroLoo after a change means you accept the updated terms.
        </p>
      </Section>
    </LegalPage>
  )
}
