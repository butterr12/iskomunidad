"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { acceptRequest, declineRequest } from "@/actions/messages";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, X } from "lucide-react";
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
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  if (status === "accepted") return null;
  if (status === "declined") {
    return (
      <div className="border-b bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
        This message request was declined.
      </div>
    );
  }

  if (!isRecipient) {
    return (
      <div className="border-b bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
        Message request sent. {requesterName ? `Waiting for ${requesterName} to accept.` : "Waiting for acceptance."}
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

  async function handleDecline() {
    setLoading("decline");
    const res = await declineRequest(conversationId);
    if (res.success) {
      toast.success("Request declined");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } else {
      toast.error(res.error);
    }
    setLoading(null);
  }

  return (
    <div className="border-b bg-muted/50 px-4 py-3">
      <p className="text-sm text-center text-muted-foreground mb-2">
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
          onClick={handleDecline}
          disabled={loading !== null}
        >
          {loading === "decline" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <X className="mr-1 h-4 w-4" />
              Decline
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
