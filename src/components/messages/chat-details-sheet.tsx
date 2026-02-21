"use client";

import Link from "next/link";
import { useState } from "react";
import {
  deleteConversation,
  deleteMessageRequest,
  type ConversationPreview,
} from "@/actions/messages";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ChatDetailsSheet({
  conversation,
  userId,
  open,
  onOpenChange,
  onDeleted,
}: {
  conversation: ConversationPreview;
  userId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isRequest = conversation.isRequest;
  const isRecipient = userId ? conversation.requestToUserId === userId : false;

  const actionTitle = isRequest
    ? isRecipient
      ? "Delete request"
      : "Cancel request"
    : "Delete conversation";
  const actionDescription = isRequest
    ? "This will remove this request thread from both users' inboxes."
    : "This will remove this conversation from both users' inboxes.";

  async function handleDelete() {
    setLoading(true);

    const res = isRequest
      ? await deleteMessageRequest(conversation.id)
      : await deleteConversation(conversation.id);

    if (!res.success) {
      toast.error(res.error);
      setLoading(false);
      return;
    }

    toast.success(actionTitle);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });

    setLoading(false);
    setConfirmOpen(false);
    onOpenChange(false);
    onDeleted?.();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Chat details</SheetTitle>
            <SheetDescription>
              Manage this conversation and quick actions.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{conversation.otherUser.name}</p>
              {conversation.otherUser.username && (
                <p className="text-xs text-muted-foreground">
                  @{conversation.otherUser.username}
                </p>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {conversation.otherUser.username ? (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/profile/${conversation.otherUser.username}`}>
                    View profile
                  </Link>
                </Button>
              ) : null}

              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {actionTitle}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTitle}?</DialogTitle>
            <DialogDescription>{actionDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? (
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
