"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EventFormWizard } from "@/components/events/event-form-wizard";
import { getEventById } from "@/actions/events";
import { useSession } from "@/lib/auth-client";
import type { CampusEvent } from "@/lib/events";

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    getEventById(id).then((res) => {
      if (!res.success) {
        setError("Event not found");
        setLoading(false);
        return;
      }
      const data = res.data as CampusEvent;
      setEvent(data);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) {
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

  if (error || !event) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <p className="text-lg font-medium">{error ?? "Event not found"}</p>
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

  if (session?.user?.id !== event.userId) {
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

  return <EventFormWizard mode="edit" initialData={event} />;
}
