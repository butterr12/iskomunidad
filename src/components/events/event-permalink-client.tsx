"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EventDetail } from "./event-detail";
import { rsvpToEvent } from "@/actions/events";
import type { CampusEvent, RsvpStatus } from "@/lib/events";

export function EventPermalinkClient({ initialEvent }: { initialEvent: CampusEvent }) {
  const router = useRouter();
  const [event, setEvent] = useState(initialEvent);

  const handleRsvpChange = async (eventId: string, status: RsvpStatus) => {
    const res = await rsvpToEvent(eventId, status);
    if (res.success) {
      setEvent((prev) => ({ ...prev, rsvpStatus: status }));
    } else {
      toast.error(res.error ?? "Failed to update RSVP.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl min-h-dvh border-x">
      <EventDetail
        event={event}
        onBack={() => router.push("/events")}
        onRsvpChange={handleRsvpChange}
      />
    </main>
  );
}
