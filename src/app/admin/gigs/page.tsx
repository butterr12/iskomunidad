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
import { adminGetAllGigs, adminApproveGig, adminRejectGig, adminDeleteGig } from "@/actions/admin";
import { formatRelativeTime } from "@/lib/posts";
import { CATEGORY_COLORS, CATEGORY_LABELS, URGENCY_LABELS, URGENCY_COLORS } from "@/lib/gigs";
import type { GigListing } from "@/lib/gigs";

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  approved: { variant: "default", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

export default function AllGigsPage() {
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);

  const fetchGigs = async () => {
    const res = await adminGetAllGigs();
    if (res.success) setGigs(res.data as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchGigs(); }, []);

  const counts = useMemo(() => {
    const c = { all: gigs.length, draft: 0, approved: 0, rejected: 0 };
    for (const g of gigs) {
      const s = g.status ?? "approved";
      c[s as keyof typeof c]++;
    }
    return c;
  }, [gigs]);

  const filtered = useMemo(() => {
    if (tab === "all") return gigs;
    return gigs.filter((g) => (g.status ?? "approved") === tab);
  }, [gigs, tab]);

  const handleApprove = async (id: string) => {
    await adminApproveGig(id);
    fetchGigs();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectGig(id, reason);
    fetchGigs();
  };

  const handleDelete = async (id: string) => {
    await adminDeleteGig(id);
    fetchGigs();
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
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No gigs found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((gig: any) => {
                const status = gig.status ?? "approved";
                const badge = STATUS_BADGE[status];
                return (
                  <TableRow key={gig.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">{gig.title}</TableCell>
                    <TableCell className="text-muted-foreground">{gig.author}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{ borderColor: CATEGORY_COLORS[gig.category as keyof typeof CATEGORY_COLORS], color: CATEGORY_COLORS[gig.category as keyof typeof CATEGORY_COLORS] }}
                      >
                        {CATEGORY_LABELS[gig.category as keyof typeof CATEGORY_LABELS] ?? gig.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{gig.compensation}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{ borderColor: URGENCY_COLORS[gig.urgency as keyof typeof URGENCY_COLORS], color: URGENCY_COLORS[gig.urgency as keyof typeof URGENCY_COLORS] }}
                      >
                        {URGENCY_LABELS[gig.urgency as keyof typeof URGENCY_LABELS]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatRelativeTime(gig.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {status !== "approved" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleApprove(gig.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {status !== "rejected" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setRejectTarget(gig)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => handleDelete(gig.id)}>
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
