"use client";

import { useState, useEffect } from "react";
import { Inbox, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/admin/reject-dialog";
import { adminGetAllEvents, adminApproveEvent, adminRejectEvent } from "@/actions/admin";

const CATEGORY_COLORS: Record<string, string> = {
  academic: "#2563eb",
  cultural: "#9333ea",
  social: "#f59e0b",
  sports: "#e11d48",
  org: "#16a34a",
};

export default function EventsQueuePage() {
  const [draftEvents, setDraftEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);

  const fetchDrafts = async () => {
    const res = await adminGetAllEvents("draft");
    if (res.success) setDraftEvents(res.data as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchDrafts(); }, []);

  const handleApprove = async (id: string) => {
    await adminApproveEvent(id);
    fetchDrafts();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectEvent(id, reason);
    fetchDrafts();
  };

  if (loading) {
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
          <Inbox className="h-10 w-10 mb-2" />
          <p>No events pending review.</p>
        </div>
      ) : (
        draftEvents.map((event: any) => (
          <Card key={event.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-semibold">{event.title}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant="outline"
                    style={{ borderColor: CATEGORY_COLORS[event.category], color: CATEGORY_COLORS[event.category] }}
                  >
                    {event.category}
                  </Badge>
                  <span>{event.organizer}</span>
                  <span>{new Date(event.startDate).toLocaleDateString()}</span>
                  {event.locationId && <span>@ {event.locationId}</span>}
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleApprove(event.id)}>
                  <Check className="mr-1 h-4 w-4" />
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejectTarget({ id: event.id, title: event.title })}>
                  <X className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {rejectTarget && (
        <RejectDialog
          open={!!rejectTarget}
          postTitle={rejectTarget.title}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            handleReject(rejectTarget.id, reason);
            setRejectTarget(null);
          }}
        />
      )}
    </div>
  );
}
