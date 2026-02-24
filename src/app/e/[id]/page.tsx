import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/site-config";
import { getEventById } from "@/actions/events";
import type { CampusEvent } from "@/lib/events";
import { EventPermalinkClient } from "@/components/events/event-permalink-client";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = Promise<{ id: string }> | { id: string };
type Props = { params: RouteParams };

async function resolveParams(params: RouteParams): Promise<{ id: string }> {
  if (typeof (params as Promise<{ id: string }>).then === "function") {
    return (await params) as { id: string };
  }
  return params as { id: string };
}

function buildDescription(event: CampusEvent): string {
  const source = event.description?.trim()
    ? event.description
    : `${event.organizer} is hosting this event on iskomunidad.`;
  if (source.length <= 160) return source;
  return `${source.slice(0, 157)}...`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await resolveParams(params);

  if (!UUID_RE.test(id)) {
    return {
      title: "Event unavailable",
      robots: { index: false, follow: false },
    };
  }

  const res = await getEventById(id);

  if (!res.success) {
    return {
      title: "Event unavailable",
      robots: { index: false, follow: false },
      alternates: { canonical: `/e/${id}` },
      openGraph: { url: `/e/${id}` },
    };
  }

  const event = res.data as CampusEvent;
  const description = buildDescription(event);
  const ogImageUrl = `${siteConfig.url}/api/og/event?id=${id}`;

  return {
    title: event.title,
    description,
    alternates: { canonical: `/e/${id}` },
    openGraph: {
      type: "article",
      url: `/e/${id}`,
      title: event.title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: event.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [ogImageUrl],
    },
    robots: { index: false, follow: false },
  };
}

export default async function EventPermalinkPage({ params }: Props) {
  const { id } = await resolveParams(params);

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const res = await getEventById(id);

  if (!res.success) {
    notFound();
  }

  const event = res.data as CampusEvent & { userRsvp?: string | null };

  return (
    <EventPermalinkClient
      initialEvent={{ ...event, rsvpStatus: (event.userRsvp ?? null) as CampusEvent["rsvpStatus"] }}
    />
  );
}
