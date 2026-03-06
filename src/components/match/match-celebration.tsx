"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HeartHandshake, MessageCircle } from "lucide-react";

interface MatchCelebrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
}

export function MatchCelebration({
  open,
  onOpenChange,
  sessionId,
}: MatchCelebrationProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs text-center">
        <DialogHeader className="items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950 mb-2 mx-auto">
            <HeartHandshake className="h-8 w-8 text-pink-500" />
          </div>
          <DialogTitle className="text-xl">It&apos;s a Match!</DialogTitle>
          <DialogDescription>
            You both liked each other. You have 48 hours to chat anonymously.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => {
              onOpenChange(false);
              router.push(`/messages?tab=anon`);
            }}
            className="gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Start Chatting
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Keep Swiping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
