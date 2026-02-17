"use client";

import { useState, useReducer } from "react";
import { Inbox, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/admin/reject-dialog";
import { getLandmarks, approveLandmark, rejectLandmark } from "@/lib/admin-store";

export default function LocationsQueuePage() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);

  const draftLandmarks = getLandmarks().filter((l) => l.status === "draft");

  const handleApprove = (id: string) => {
    approveLandmark(id);
    rerender();
  };

  const handleReject = (id: string, reason: string) => {
    rejectLandmark(id, reason);
    rerender();
  };

  return (
    <div className="space-y-4">
      {draftLandmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-2" />
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
                  <span>({landmark.lat.toFixed(4)}, {landmark.lng.toFixed(4)})</span>
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
