import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EventsTab } from "@/components/events/events-tab";

export const metadata: Metadata = {
  title: "Events",
  description: "Browse upcoming campus events and track what you're attending.",
  alternates: { canonical: "/events" },
  openGraph: { url: "/events" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { searchParams: Promise<Record<string, string>> };

export default async function EventsPage({ searchParams }: Props) {
  const params = await searchParams;
  if (params.event && UUID_RE.test(params.event)) {
    redirect(`/e/${params.event}`);
  }

  return (
    <main className="flex flex-1 flex-col min-h-0">
      <EventsTab />
    </main>
  );
}
