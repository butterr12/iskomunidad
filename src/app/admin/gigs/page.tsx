"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  adminGetAllGigs,
  adminApproveGig,
  adminRejectGig,
  adminDeleteGig,
} from "@/actions/admin";
import {
  formatRelativeTime,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  URGENCY_LABELS,
  URGENCY_COLORS,
} from "@/lib/gigs";

type ModerationStatus = "draft" | "approved" | "rejected";

interface AdminGigRow {
  id: string;
  title: string;
  author: string;
  category: string;
  compensation: string;
  urgency: string;
  status?: ModerationStatus;
  createdAt: string;
}

const STATUS_BADGE: Record<
  ModerationStatus,
  { variant: "default" | "secondary" | "destructive"; label: string }
> = {
  draft: { variant: "secondary", label: "Draft" },
  approved: { variant: "default", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

const GIGS_QUERY_KEY = ["admin-gigs"] as const;

export default function AllGigsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<AdminGigRow | null>(null);

  const { data: gigs = [], isLoading } = useQuery({
    queryKey: GIGS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllGigs();
      return res.success ? (res.data as AdminGigRow[]) : [];
    },
  });

  const counts = useMemo(() => {
    const c = { all: gigs.length, draft: 0, approved: 0, rejected: 0 };
    for (const gig of gigs) {
      const status = gig.status ?? "approved";
      c[status]++;
    }
    return c;
  }, [gigs]);

  const filtered = useMemo(() => {
    if (tab === "all") return gigs;
    return gigs.filter((gig) => (gig.status ?? "approved") === tab);
  }, [gigs, tab]);

  const refreshGigs = async () => {
    await queryClient.invalidateQueries({ queryKey: GIGS_QUERY_KEY });
  };

  const handleApprove = async (id: string) => {
    await adminApproveGig(id);
    await refreshGigs();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectGig(id, reason);
    await refreshGigs();
  };

  const handleDelete = async (id: string) => {
    await adminDeleteGig(id);
    await refreshGigs();
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
              <TableHead>Author</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Compensation</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
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
                  No gigs found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((gig) => {
                const status = gig.status ?? "approved";
                const badge = STATUS_BADGE[status];
                const categoryColor =
                  CATEGORY_COLORS[gig.category as keyof typeof CATEGORY_COLORS] ??
                  "#6b7280";
                const urgencyColor =
                  URGENCY_COLORS[gig.urgency as keyof typeof URGENCY_COLORS] ??
                  "#6b7280";
                return (
                  <TableRow key={gig.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {gig.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {gig.author}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: categoryColor,
                          color: categoryColor,
                        }}
                      >
                        {CATEGORY_LABELS[
                          gig.category as keyof typeof CATEGORY_LABELS
                        ] ?? gig.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {gig.compensation}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: urgencyColor,
                          color: urgencyColor,
                        }}
                      >
                        {URGENCY_LABELS[
                          gig.urgency as keyof typeof URGENCY_LABELS
                        ] ?? gig.urgency}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(gig.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {status !== "approved" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600"
                            onClick={() => handleApprove(gig.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {status !== "rejected" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            onClick={() => setRejectTarget(gig)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => handleDelete(gig.id)}
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
          postTitle={rejectTarget.title}
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
