"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/admin/reject-dialog";
import {
  adminGetAllEvents,
  adminApproveEvent,
  adminRejectEvent,
} from "@/actions/admin";

interface AdminEventRow {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  organizer: string;
  startDate: string;
  locationId: string | null;
  rejectionReason?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  academic: "#2563eb",
  cultural: "#9333ea",
  social: "#f59e0b",
  sports: "#e11d48",
  org: "#16a34a",
};

const DRAFT_EVENTS_QUERY_KEY = ["admin-events", "draft"] as const;

export default function EventsQueuePage() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const { data: draftEvents = [], isLoading } = useQuery({
    queryKey: DRAFT_EVENTS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllEvents("draft");
      return res.success ? (res.data as AdminEventRow[]) : [];
    },
  });

  const refreshDrafts = async () => {
    await queryClient.invalidateQueries({ queryKey: DRAFT_EVENTS_QUERY_KEY });
  };

  const handleApprove = async (id: string) => {
    const result = await adminApproveEvent(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Event published");
    await refreshDrafts();
  };

  const handleReject = async (id: string, reason: string) => {
    const result = await adminRejectEvent(id, reason);
    if (!result.success) toast.error(result.error);
    else toast.success("Event declined");
    await refreshDrafts();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {draftEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="mb-2 h-10 w-10" />
          <p>No events pending review.</p>
        </div>
      ) : (
        draftEvents.map((event) => {
          const categoryColor = CATEGORY_COLORS[event.category] ?? "#6b7280";
          return (
            <Card key={event.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-semibold">{event.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: categoryColor,
                        color: categoryColor,
                      }}
                    >
                      {event.category}
                    </Badge>
                    <span>{event.organizer}</span>
                    <span>{new Date(event.startDate).toLocaleDateString()}</span>
                    {event.locationId && <span>@ {event.locationId}</span>}
                  </div>
                  {event.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {event.description}
                    </p>
                  )}
                  {event.rejectionReason && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      AI flag: {event.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600"
                    onClick={() => handleApprove(event.id)}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() =>
                      setRejectTarget({ id: event.id, title: event.title })
                    }
                  >
                    <X className="mr-1 h-4 w-4" />
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {rejectTarget && (
        <RejectDialog
          open={!!rejectTarget}
          itemTitle={rejectTarget.title}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            void handleReject(rejectTarget.id, reason);
            setRejectTarget(null);
          }}
        />
      )}
    </div>
  );
}
