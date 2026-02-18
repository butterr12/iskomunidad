import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSIONS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | iskomunidad",
  description:
    "Terms governing the use of iskomunidad and its campus community features.",
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

export default function TermsOfServicePage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            Effective date: {effectiveDate}
          </p>
          <p className="text-xs text-muted-foreground">
            Terms version: {LEGAL_VERSIONS.terms}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            These Terms of Service govern your use of iskomunidad, including map,
            community posts, comments, events, gigs, admin moderation workflows,
            and related services.
          </p>
        </div>

        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using iskomunidad, you agree to these Terms and our{" "}
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the service.
          </p>
        </Section>

        <Section title="2. Eligibility and Accounts">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You must provide accurate registration information and keep your
              account credentials secure.
            </li>
            <li>
              You are responsible for actions taken through your account unless
              caused by our fault.
            </li>
            <li>
              You must be at least 16 years old to use iskomunidad.
            </li>
            <li>
              If you are under 18, you attest that you have explicit consent
              from your parent or legal guardian to use iskomunidad and agree to
              these Terms.
            </li>
          </ul>
        </Section>

        <Section title="3. Community Conduct">
          <p>You agree not to post or submit content that:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>is unlawful, fraudulent, or misleading;</li>
            <li>contains threats, harassment, hate, or targeted abuse;</li>
            <li>contains explicit sexual content or illegal material;</li>
            <li>is spam, scams, or malicious promotions;</li>
            <li>infringes intellectual property or privacy rights; or</li>
            <li>attempts to compromise platform security.</li>
          </ul>
        </Section>

        <Section title="4. User Content and License">
          <p>
            You retain ownership of content you submit. By posting on
            iskomunidad, you grant us a non-exclusive, worldwide, royalty-free
            license to host, store, reproduce, and display that content as needed
            to operate and improve the service.
          </p>
        </Section>

        <Section title="5. Moderation and Enforcement">
          <p>
            iskomunidad may apply automatic, manual, or optional AI-based
            moderation. We may review, restrict, reject, or remove content and
            may suspend accounts for policy or Terms violations.
          </p>
        </Section>

        <Section title="6. Events, Gigs, and User Interactions">
          <p>
            iskomunidad is a platform that helps users discover opportunities and
            connect. We do not guarantee the accuracy, legality, safety, quality,
            or outcomes of user-posted events, gigs, contact methods, or third
            party interactions.
          </p>
          <p>
            You are responsible for your own decisions, communication, and any
            offline or external transactions.
          </p>
        </Section>

        <Section title="7. Third-Party Services">
          <p>
            Certain functions rely on third-party providers (such as map,
            email, storage, and moderation services). Their service availability
            and terms may affect app behavior.
          </p>
        </Section>

        <Section title="8. Service Availability and Changes">
          <p>
            We may update, pause, or discontinue any part of the service at any
            time. We are not liable for downtime, maintenance windows, or
            feature-level changes made in good faith.
          </p>
        </Section>

        <Section title="9. Disclaimers">
          <p>
            The service is provided on an &quot;as is&quot; and
            &quot;as available&quot; basis to the extent allowed by law, without
            warranties of uninterrupted service, fitness for a specific purpose,
            or error-free operation.
          </p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>
            To the fullest extent permitted by law, iskomunidad and its operators
            are not liable for indirect, incidental, special, consequential, or
            punitive damages arising from platform use, including user-generated
            content and third-party conduct.
          </p>
        </Section>

        <Section title="11. Indemnity">
          <p>
            You agree to indemnify and hold harmless iskomunidad and its
            operators from claims, liabilities, and expenses arising from your
            misuse of the service, your content, or your violation of these
            Terms.
          </p>
        </Section>

        <Section title="12. Governing Law and Venue">
          <p>
            These Terms are governed by the laws of the Republic of the
            Philippines. Any dispute shall be brought before the proper courts in
            Taguig City, Philippines, subject to applicable law.
          </p>
        </Section>

        <Section title="13. Changes to These Terms">
          <p>
            We may revise these Terms. Continued use of the service after changes
            take effect means you accept the updated Terms.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            Terms concerns:{" "}
            <a
              href="mailto:contact@hello.iskomunidad.com"
              className="underline-offset-4 hover:underline"
            >
              contact@hello.iskomunidad.com
            </a>
          </p>
          <p>
            Data privacy concerns:{" "}
            <a
              href="mailto:contact@hello.iskomunidad.com"
              className="underline-offset-4 hover:underline"
            >
              contact@hello.iskomunidad.com
            </a>
          </p>
        </Section>
      </div>
    </main>
  );
}
