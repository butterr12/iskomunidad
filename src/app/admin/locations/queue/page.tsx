"use client";

import { useState, useEffect } from "react";
import { Inbox, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/admin/reject-dialog";
import { adminGetAllLandmarks, adminApproveLandmark, adminRejectLandmark } from "@/actions/admin";

export default function LocationsQueuePage() {
  const [draftLandmarks, setDraftLandmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);

  const fetchDrafts = async () => {
    const res = await adminGetAllLandmarks("draft");
    if (res.success) setDraftLandmarks(res.data as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchDrafts(); }, []);

  const handleApprove = async (id: string) => {
    await adminApproveLandmark(id);
    fetchDrafts();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectLandmark(id, reason);
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
      {draftLandmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-2" />
          <p>No locations pending review.</p>
        </div>
      ) : (
        draftLandmarks.map((landmark: any) => (
          <Card key={landmark.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-semibold">{landmark.name}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{landmark.category}</Badge>
                  {landmark.address && <span>{landmark.address}</span>}
                  <span>({Number(landmark.lat).toFixed(4)}, {Number(landmark.lng).toFixed(4)})</span>
                </div>
                {landmark.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{landmark.description}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleApprove(landmark.id)}>
                  <Check className="mr-1 h-4 w-4" />
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejectTarget({ id: landmark.id, title: landmark.name })}>
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
