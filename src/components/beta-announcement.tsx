"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocalDismiss } from "@/hooks/use-local-dismiss";

const STORAGE_KEY = "iskomunidad:beta-announcement-dismissed";

export function BetaAnnouncement() {
  const [isDismissed, dismiss] = useLocalDismiss(STORAGE_KEY);

  return (
    <Dialog open={!isDismissed} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-sm" showCloseButton={false}>
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>Welcome to iskomunidad!</DialogTitle>
          <DialogDescription className="text-left space-y-2">
            <span className="block">
              You&apos;re one of our earliest users! This app is still in its
              early stages &mdash; expect rough edges, missing features, and
              the occasional bug.
            </span>
            <span className="block">
              Your feedback helps us shape this into something great for the
              community. Thanks!
            </span>
            <span className="block text-right text-muted-foreground">
              &mdash; Krisha &amp; Lesmon
            </span>
          </DialogDescription>
        </DialogHeader>

        <Button onClick={dismiss} className="w-full">
          Got it, let&apos;s go!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
