"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { acceptRequest, deleteMessageRequest } from "@/actions/messages";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function RequestBanner({
  conversationId,
  isRecipient,
  requesterName,
  status,
}: {
  conversationId: string;
  isRecipient: boolean;
  requesterName: string;
  status?: string;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<"accept" | "delete" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (status === "accepted") return null;
  if (status === "declined") {
    return (
      <div className="border-b bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
        This message request was declined.
      </div>
    );
  }
  if (status === "withdrawn") {
    return (
      <div className="border-b bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
        This message request was canceled.
      </div>
    );
  }

  async function handleAccept() {
    setLoading("accept");
    const res = await acceptRequest(conversationId);
    if (res.success) {
      toast.success("Request accepted");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["messages", conversationId],
      });
    } else {
      toast.error(res.error);
    }
    setLoading(null);
  }

  async function handleDeleteRequest() {
    setLoading("delete");
    const res = await deleteMessageRequest(conversationId);
    if (res.success) {
      toast.success(isRecipient ? "Request deleted" : "Request canceled");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["messages", conversationId],
      });
      setConfirmOpen(false);
    } else {
      toast.error(res.error);
    }
    setLoading(null);
  }

  const deleteLabel = isRecipient ? "Delete request" : "Cancel request";

  if (!isRecipient) {
    return (
      <>
        <div className="border-b bg-muted/50 px-4 py-3">
          <p className="text-center text-sm text-muted-foreground">
            Message request sent. {requesterName ? `Waiting for ${requesterName} to respond.` : "Waiting for response."}
          </p>
          <div className="mt-2 flex items-center justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={loading !== null}
            >
              {loading === "delete" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="mr-1 h-4 w-4" />
                  {deleteLabel}
                </>
              )}
            </Button>
          </div>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{deleteLabel}?</DialogTitle>
              <DialogDescription>
                This will remove this message request for both users.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={loading !== null}
              >
                Keep
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteRequest}
                disabled={loading !== null}
              >
                {loading === "delete" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Confirm
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="border-b bg-muted/50 px-4 py-3">
        <p className="mb-2 text-center text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{requesterName}</span> wants to send you a message
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleAccept}
            disabled={loading !== null}
          >
            {loading === "accept" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="mr-1 h-4 w-4" />
                Accept
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={loading !== null}
          >
            {loading === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="mr-1 h-4 w-4" />
                {deleteLabel}
              </>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteLabel}?</DialogTitle>
            <DialogDescription>
              This will remove this message request for both users.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={loading !== null}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRequest}
              disabled={loading !== null}
            >
              {loading === "delete" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
