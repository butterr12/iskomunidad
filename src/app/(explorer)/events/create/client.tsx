"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { EventFormWizard } from "@/components/events/event-form-wizard";
import { CreatePageHeader } from "@/components/shared/create-page-header";

export function CreateEventPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      <CreatePageHeader title="Create Event" fallbackHref="/events" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4">
          <div className="rounded-2xl border bg-card shadow-sm p-6 flex flex-col gap-4">
            <EventFormWizard
              mode="create"
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["approved-events"] });
                router.push("/events");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
