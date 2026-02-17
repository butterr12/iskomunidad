import type { Metadata } from "next";
import { EventsTab } from "@/components/events/events-tab";

export const metadata: Metadata = {
  title: "Events | iskomunidad",
  description: "Browse upcoming campus events and track what you're attending.",
};

export default function EventsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <EventsTab />
    </main>
  );
}
