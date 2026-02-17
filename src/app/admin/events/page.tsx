"use client";

import { useState, useMemo, useEffect } from "react";
import { Check, X, Trash2, Loader2 } from "lucide-react";
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
import { adminGetAllEvents, adminApproveEvent, adminRejectEvent, adminDeleteEvent } from "@/actions/admin";
import { formatRelativeTime } from "@/lib/posts";
import type { CampusEvent } from "@/lib/events";

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  approved: { variant: "default", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

const CATEGORY_COLORS: Record<string, string> = {
  academic: "#2563eb",
  cultural: "#9333ea",
  social: "#f59e0b",
  sports: "#e11d48",
  org: "#16a34a",
};

export default function AllEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<CampusEvent | null>(null);

  const fetchEvents = async () => {
    const res = await adminGetAllEvents();
    if (res.success) setEvents(res.data as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const counts = useMemo(() => {
    const c = { all: events.length, draft: 0, approved: 0, rejected: 0 };
    for (const e of events) {
      const s = e.status ?? "approved";
      c[s as keyof typeof c]++;
    }
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    if (tab === "all") return events;
    return events.filter((e) => (e.status ?? "approved") === tab);
  }, [events, tab]);

  const handleApprove = async (id: string) => {
    await adminApproveEvent(id);
    fetchEvents();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectEvent(id, reason);
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    await adminDeleteEvent(id);
    fetchEvents();
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
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({counts.draft})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
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
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No events found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((event: any) => {
                const status = event.status ?? "approved";
                const badge = STATUS_BADGE[status];
                return (
                  <TableRow key={event.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">{event.title}</TableCell>
                    <TableCell className="text-muted-foreground">{event.organizer}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{ borderColor: CATEGORY_COLORS[event.category], color: CATEGORY_COLORS[event.category] }}
                      >
                        {event.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{event.locationId ?? "Online"}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{event.attendeeCount}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(event.startDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {status !== "approved" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleApprove(event.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {status !== "rejected" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setRejectTarget(event)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => handleDelete(event.id)}>
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
