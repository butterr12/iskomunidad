"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RejectDialogProps {
  open: boolean;
  itemTitle: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  /** @deprecated Use itemTitle instead */
  postTitle?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
}

export function RejectDialog({
  open,
  itemTitle,
  postTitle,
  onClose,
  onConfirm,
  title = "Decline",
  description,
  confirmLabel = "Decline",
  reasonLabel = "Reason",
  reasonPlaceholder = "Enter reason for declining...",
}: RejectDialogProps) {
  const [reason, setReason] = useState("");
  const resolvedTitle = itemTitle ?? postTitle ?? "";

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason("");
    }
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? `Declining "${resolvedTitle}". Please provide a reason.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">{reasonLabel}</Label>
          <Textarea
            id="reason"
            placeholder={reasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
