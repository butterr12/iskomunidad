"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/admin/reject-dialog";
import {
  adminGetAllEvents,
  adminApproveEvent,
  adminRejectEvent,
  adminDeleteEvent,
} from "@/actions/admin";

type ModerationStatus = "draft" | "approved" | "rejected";

interface AdminEventRow {
  id: string;
  title: string;
  organizer: string;
  category: string;
  locationId: string | null;
  status?: ModerationStatus;
  attendeeCount: number;
  startDate: string;
}

const STATUS_BADGE: Record<
  ModerationStatus,
  { variant: "default" | "secondary" | "destructive"; label: string }
> = {
  draft: { variant: "secondary", label: "Pending" },
  approved: { variant: "default", label: "Published" },
  rejected: { variant: "destructive", label: "Declined" },
};

const CATEGORY_COLORS: Record<string, string> = {
  academic: "#2563eb",
  cultural: "#9333ea",
  social: "#f59e0b",
  sports: "#e11d48",
  org: "#16a34a",
};

const EVENTS_QUERY_KEY = ["admin-events"] as const;

export default function AllEventsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<AdminEventRow | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllEvents();
      return res.success ? (res.data as AdminEventRow[]) : [];
    },
  });

  const counts = useMemo(() => {
    const c = { all: events.length, draft: 0, approved: 0, rejected: 0 };
    for (const event of events) {
      const status = event.status ?? "approved";
      c[status]++;
    }
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    if (tab === "all") return events;
    return events.filter((event) => (event.status ?? "approved") === tab);
  }, [events, tab]);

  const refreshEvents = async () => {
    await queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
  };

  const handleApprove = async (id: string) => {
    const result = await adminApproveEvent(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Event published");
    await refreshEvents();
  };

  const handleReject = async (id: string, reason: string) => {
    const result = await adminRejectEvent(id, reason);
    if (!result.success) toast.error(result.error);
    else toast.success("Event declined");
    await refreshEvents();
  };

  const handleDelete = async (id: string) => {
    const result = await adminDeleteEvent(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Event deleted");
    await refreshEvents();
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
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="draft">Pending ({counts.draft})</TabsTrigger>
          <TabsTrigger value="approved">Published ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Declined ({counts.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Organizer</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Attendees</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  No events found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((event) => {
                const status = event.status ?? "approved";
                const badge = STATUS_BADGE[status];
                const categoryColor = CATEGORY_COLORS[event.category] ?? "#6b7280";
                return (
                  <TableRow key={event.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {event.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.organizer}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: categoryColor,
                          color: categoryColor,
                        }}
                      >
                        {event.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.locationId ?? "Online"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {event.attendeeCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(event.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {status === "draft" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600"
                              onClick={() => handleApprove(event.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-600"
                              onClick={() => setRejectTarget(event)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => handleDelete(event.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
