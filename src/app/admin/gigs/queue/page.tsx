"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/admin/reject-dialog";
import {
  adminGetAllGigs,
  adminApproveGig,
  adminRejectGig,
} from "@/actions/admin";
import { CATEGORY_COLORS, URGENCY_LABELS, URGENCY_COLORS } from "@/lib/gigs";

interface AdminGigRow {
  id: string;
  title: string;
  description?: string | null;
  author: string;
  category: string;
  urgency: string;
  compensation: string;
}

const DRAFT_GIGS_QUERY_KEY = ["admin-gigs", "draft"] as const;

export default function GigsQueuePage() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const { data: draftGigs = [], isLoading } = useQuery({
    queryKey: DRAFT_GIGS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllGigs("draft");
      return res.success ? (res.data as AdminGigRow[]) : [];
    },
  });

  const refreshDrafts = async () => {
    await queryClient.invalidateQueries({ queryKey: DRAFT_GIGS_QUERY_KEY });
  };

  const handleApprove = async (id: string) => {
    await adminApproveGig(id);
    await refreshDrafts();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectGig(id, reason);
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
      {draftGigs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="mb-2 h-10 w-10" />
          <p>No gigs pending review.</p>
        </div>
      ) : (
        draftGigs.map((gig) => {
          const categoryColor =
            CATEGORY_COLORS[gig.category as keyof typeof CATEGORY_COLORS] ??
            "#6b7280";
          const urgencyColor =
            URGENCY_COLORS[gig.urgency as keyof typeof URGENCY_COLORS] ??
            "#6b7280";
          return (
            <Card key={gig.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-semibold">{gig.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: categoryColor,
                        color: categoryColor,
                      }}
                    >
                      {gig.category}
                    </Badge>
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
                    <span>{gig.author}</span>
                    <span>{gig.compensation}</span>
                  </div>
                  {gig.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {gig.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600"
                    onClick={() => handleApprove(gig.id)}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() =>
                      setRejectTarget({ id: gig.id, title: gig.title })
                    }
                  >
                    <X className="mr-1 h-4 w-4" />
                    Reject
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
