import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSIONS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How iskomunidad collects, uses, and protects personal information under Philippine data privacy principles.",
  alternates: { canonical: "/privacy" },
  openGraph: { url: "/privacy" },
};

const effectiveDate = LEGAL_EFFECTIVE_DATE;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="h-dvh overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6 sm:py-12">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to iskomunidad
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Effective date: {effectiveDate}
          </p>
          <p className="text-xs text-muted-foreground">
            Policy version: {LEGAL_VERSIONS.privacy}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            This Privacy Policy describes how iskomunidad handles personal data
            when you use our platform. We designed this policy around how the app
            currently works, including account auth, community posting, events,
            gigs, map features, moderation, and notifications.
          </p>
        </div>

        <Section title="1. Scope">
          <p>
            This policy applies to personal data processed through the
            iskomunidad web app and related services. It is intended to align
            with the Philippine Data Privacy Act of 2012 (Republic Act No.
            10173), its Implementing Rules and Regulations, and National Privacy
            Commission guidance.
          </p>
        </Section>

        <Section title="2. Personal Data We Collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Account data: name, username, email address, password credentials,
              email verification status, role, and optional profile image.
            </li>
            <li>
              Profile and settings data: updated display name/username, avatar,
              password change activity, and notification preferences.
            </li>
            <li>
              Content you create: posts, comments, votes, events, RSVPs, gigs,
              gig swipes, landmarks, reviews, photos, and other submitted text.
            </li>
            <li>
              Session/security data: session token records, IP address, user
              agent, and session expiry metadata.
            </li>
            <li>
              Map/location data: landmark coordinates and optional browser
              geolocation used in admin location pinning (only if you grant
              browser permission). If coordinates are submitted, they are stored
              as part of location content.
            </li>
            <li>
              Upload data: image files uploaded for profile photos and admin
              location photos.
            </li>
            <li>
              Browser-side storage: authentication cookies and local storage
              entries used for app preferences (such as install prompt dismissal
              and theme behavior).
            </li>
          </ul>
        </Section>

        <Section title="3. How We Use Personal Data">
          <ul className="list-disc space-y-1 pl-5">
            <li>Provide and secure account sign-up/sign-in.</li>
            <li>Send verification, magic-link, and password reset emails.</li>
            <li>
              Operate community features (map, posts, comments, events, gigs,
              notifications).
            </li>
            <li>
              Moderate content using configured workflow (auto/manual/admin, and
              optional AI moderation).
            </li>
            <li>Support platform safety, abuse prevention, and troubleshooting.</li>
            <li>Comply with legal obligations and enforce Terms of Service.</li>
          </ul>
        </Section>

        <Section title="4. Legal Bases for Processing (Philippines)">
          <p>
            Depending on the activity, we process personal data based on consent,
            contractual necessity (providing the service you requested), legal
            obligations, and legitimate interests such as fraud prevention and
            platform security, consistent with applicable Philippine privacy law.
          </p>
        </Section>

        <Section title="5. Sharing and Disclosure">
          <p>We share data only when needed to operate the service, including:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Authentication, database, and hosting infrastructure providers.
            </li>
            <li>
              Email delivery provider for verification/sign-in/reset messages.
            </li>
            <li>
              Object storage provider for uploaded images and secure photo access.
            </li>
            <li>Map/photo providers for map rendering and place imagery.</li>
            <li>
              Optional AI provider for automated moderation when enabled by admin
              settings.
            </li>
            <li>
              Authorized admins/moderators who review content and manage safety.
            </li>
            <li>
              Law enforcement or regulators when required by law or lawful order.
            </li>
          </ul>
          <p>
            We do not currently sell personal data and we do not run third-party
            advertising trackers in this app.
          </p>
        </Section>

        <Section title="6. Cross-Border Processing">
          <p>
            Some service providers may process data outside the Philippines.
            Where this happens, we use reasonable safeguards and provider
            agreements to protect personal data.
          </p>
        </Section>

        <Section title="7. Data Retention">
          <p>
            Unless required otherwise by law, iskomunidad currently retains
            personal data and user-generated content indefinitely for ongoing
            service operations, safety, moderation, legal compliance, and
            dispute handling.
          </p>
        </Section>

        <Section title="8. Your Rights Under Philippine Data Privacy Law">
          <p>
            Subject to legal limits, you may request access, correction,
            objection, erasure/blocking, and portability of your personal data,
            and you may file a complaint with the National Privacy Commission.
          </p>
          <p>
            For requests, contact us at{" "}
            <a
              href="mailto:contact@hello.iskomunidad.com"
              className="underline-offset-4 hover:underline"
            >
              contact@hello.iskomunidad.com
            </a>
            .
          </p>
        </Section>

        <Section title="9. Security">
          <p>
            We implement reasonable technical and organizational safeguards for
            account security, access control, and storage protection. No system
            is perfectly secure, so we encourage strong passwords and prompt
            reporting of suspicious activity.
          </p>
        </Section>

        <Section title="10. Minors">
          <p>
            You must be at least 16 years old to create an account or use
            iskomunidad.
          </p>
          <p>
            If you are under 18, you attest that you have explicit consent from
            your parent or legal guardian for your use of the service and the
            processing of your personal data under this Privacy Policy.
          </p>
        </Section>

        <Section title="11. Policy Updates">
          <p>
            We may update this Privacy Policy as the app evolves. Material
            changes will be posted with a new effective date on this page.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            Privacy inquiries and data subject requests:{" "}
            <a
              href="mailto:contact@hello.iskomunidad.com"
              className="underline-offset-4 hover:underline"
            >
              contact@hello.iskomunidad.com
            </a>
          </p>
          <p>
            You can also review our{" "}
            <Link href="/terms" className="underline-offset-4 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}
