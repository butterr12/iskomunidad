import type { Metadata } from "next";
import { EventsTab } from "@/components/events/events-tab";

export const metadata: Metadata = {
  title: "Events",
  description: "Browse upcoming campus events and track what you're attending.",
  alternates: { canonical: "/events" },
  openGraph: { url: "/events" },
};

export default function EventsPage() {
  return (
    <main className="flex flex-1 flex-col min-h-0">
      <EventsTab />
    </main>
  );
}
