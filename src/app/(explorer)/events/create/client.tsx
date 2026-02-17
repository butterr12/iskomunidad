"use client";

import { useRouter } from "next/navigation";
import { EventFormWizard } from "@/components/events/event-form-wizard";

export function CreateEventPageClient() {
  const router = useRouter();

  return (
    <EventFormWizard
      mode="create"
      open={true}
      onOpenChange={(isOpen) => {
        if (!isOpen) router.push("/events");
      }}
      onSuccess={() => router.push("/events")}
    />
  );
}
