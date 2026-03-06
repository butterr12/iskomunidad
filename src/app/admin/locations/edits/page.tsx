"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RejectDialog } from "@/components/admin/reject-dialog";
import { toast } from "sonner";
import {
  adminGetPendingEdits,
  adminApproveEdit,
  adminRejectEdit,
} from "@/actions/admin";

interface PendingEdit {
  id: string;
  landmarkId: string;
  landmarkName: string;
  changes: Record<string, unknown>;
  note: string | null;
  createdAt: string;
  authorName: string | null;
  authorHandle: string | null;
  authorImage: string | null;
}

const EDITS_QUERY_KEY = ["admin-pending-edits"] as const;

function ChangeDiff({ changes }: { changes: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      {Object.entries(changes).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 text-xs">
          <Badge variant="outline" className="shrink-0">
            {key}
          </Badge>
          <span className="text-muted-foreground break-all">
            {typeof value === "string"
              ? value
              : value === null
                ? "(cleared)"
                : JSON.stringify(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function EditSuggestionsPage() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const { data: edits = [], isLoading } = useQuery({
    queryKey: EDITS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetPendingEdits();
      return res.success ? (res.data as PendingEdit[]) : [];
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: EDITS_QUERY_KEY });
  };

  const handleApprove = async (id: string) => {
    const result = await adminApproveEdit(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Edit applied");
    await refresh();
  };

  const handleReject = async (id: string, reason: string) => {
    const result = await adminRejectEdit(id, reason);
    if (!result.success) toast.error(result.error);
    else toast.success("Edit suggestion rejected");
    await refresh();
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
      <h2 className="text-lg font-semibold">Edit Suggestions</h2>

      {edits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="mb-2 h-10 w-10" />
          <p>No pending edit suggestions.</p>
        </div>
      ) : (
        edits.map((edit) => (
          <Card key={edit.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold">{edit.landmarkName}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="h-5 w-5">
                      {edit.authorImage && (
                        <AvatarImage src={edit.authorImage} alt="" />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {(edit.authorName ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {edit.authorName}
                      {edit.authorHandle && (
                        <span className="ml-1 text-muted-foreground">
                          {edit.authorHandle}
                        </span>
                      )}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(edit.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600"
                    onClick={() => handleApprove(edit.id)}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() =>
                      setRejectTarget({
                        id: edit.id,
                        title: edit.landmarkName,
                      })
                    }
                  >
                    <X className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>

              <ChangeDiff changes={edit.changes} />

              {edit.note && (
                <p className="text-xs text-muted-foreground italic">
                  &quot;{edit.note}&quot;
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {rejectTarget && (
        <RejectDialog
          open={!!rejectTarget}
          itemTitle={rejectTarget.title}
          title="Reject Edit Suggestion"
          confirmLabel="Reject"
          reasonPlaceholder="Why is this suggestion being rejected?"
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
