"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { EventFormWizard } from "@/components/events/event-form-wizard";
import { CreatePageHeader } from "@/components/shared/create-page-header";
import { getEventById } from "@/actions/events";
import { useSession } from "@/lib/auth-client";
import type { CampusEvent } from "@/lib/events";

type LoadState = {
  event: CampusEvent | null;
  loading: boolean;
  error: string | null;
};

export function EditEventPageClient() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [state, setState] = useState<LoadState>({
    event: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    getEventById(id).then((res) => {
      if (!res.success) {
        setState({ event: null, loading: false, error: "Event not found" });
        return;
      }
      setState({
        event: res.data as CampusEvent,
        loading: false,
        error: null,
      });
    });
  }, [params.id]);

  if (state.loading) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Event" fallbackHref="/events" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (state.error || !state.event) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Event" fallbackHref="/events" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-lg font-medium">{state.error ?? "Event not found"}</p>
            <button
              onClick={() => router.push("/events")}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Back to Events
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session?.user?.id !== state.event.userId) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Event" fallbackHref="/events" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-lg font-medium">Not authorized</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You can only edit your own events.
            </p>
            <button
              onClick={() => router.push("/events")}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Back to Events
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      <CreatePageHeader title="Edit Event" fallbackHref="/events" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4">
          <div className="rounded-2xl border bg-card shadow-sm p-6 flex flex-col gap-4">
            <EventFormWizard
              mode="edit"
              initialData={state.event}
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
