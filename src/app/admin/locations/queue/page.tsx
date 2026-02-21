"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/admin/reject-dialog";
import { toast } from "sonner";
import {
  adminGetAllLandmarks,
  adminApproveLandmark,
  adminRejectLandmark,
} from "@/actions/admin";

interface AdminLandmarkRow {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  address: string | null;
  lat: number;
  lng: number;
}

const DRAFT_LANDMARKS_QUERY_KEY = ["admin-landmarks", "draft"] as const;

export default function LocationsQueuePage() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const { data: draftLandmarks = [], isLoading } = useQuery({
    queryKey: DRAFT_LANDMARKS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllLandmarks("draft");
      return res.success ? (res.data as AdminLandmarkRow[]) : [];
    },
  });

  const refreshDrafts = async () => {
    await queryClient.invalidateQueries({
      queryKey: DRAFT_LANDMARKS_QUERY_KEY,
    });
  };

  const handleApprove = async (id: string) => {
    const result = await adminApproveLandmark(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Location published");
    await refreshDrafts();
  };

  const handleReject = async (id: string, reason: string) => {
    const result = await adminRejectLandmark(id, reason);
    if (!result.success) toast.error(result.error);
    else toast.success("Location declined");
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
      {draftLandmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="mb-2 h-10 w-10" />
          <p>No locations pending review.</p>
        </div>
      ) : (
        draftLandmarks.map((landmark) => (
          <Card key={landmark.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-semibold">{landmark.name}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{landmark.category}</Badge>
                  {landmark.address && <span>{landmark.address}</span>}
                  <span>
                    ({Number(landmark.lat).toFixed(4)},{" "}
                    {Number(landmark.lng).toFixed(4)})
                  </span>
                </div>
                {landmark.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {landmark.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600"
                  onClick={() => handleApprove(landmark.id)}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  onClick={() =>
                    setRejectTarget({ id: landmark.id, title: landmark.name })
                  }
                >
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
          itemTitle={rejectTarget.title}
          title="Reject Location"
          confirmLabel="Reject"
          reasonPlaceholder="Enter rejection reason..."
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
