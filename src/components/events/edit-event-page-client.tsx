"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EventFormWizard } from "@/components/events/event-form-wizard";
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
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (state.error || !state.event) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
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
    );
  }

  if (session?.user?.id !== state.event.userId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
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
    );
  }

  return (
    <EventFormWizard
      mode="edit"
      initialData={state.event}
      open={true}
      onOpenChange={(isOpen) => {
        if (!isOpen) router.push("/events");
      }}
      onSuccess={() => router.push("/events")}
    />
  );
}
