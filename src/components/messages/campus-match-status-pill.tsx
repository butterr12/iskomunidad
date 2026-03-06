"use client";

import { useRouter } from "next/navigation";
import { Ghost, Hourglass, MessageCircleWarning, Sparkles } from "lucide-react";
import { useSocket } from "@/components/providers/socket-provider";
import { Button } from "@/components/ui/button";

export function CampusMatchStatusPill() {
  const router = useRouter();
  const { campusMatchState } = useSocket();

  if (!campusMatchState || campusMatchState.status === "idle") {
    return null;
  }

  const openCampusMatch = () => {
    router.push("/messages?tab=anon");
  };

  if (campusMatchState.status === "banned") {
    return (
      <div className="border-b bg-amber-50/80 px-3 py-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <MessageCircleWarning className="h-4 w-4" />
            Campus Match temporarily unavailable
          </span>
          <Button variant="outline" size="sm" onClick={openCampusMatch}>
            View
          </Button>
        </div>
      </div>
    );
  }

  if (campusMatchState.status === "waiting") {
    return (
      <div className="border-b bg-primary/5 px-3 py-2">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-primary">
            <Hourglass className="h-4 w-4" />
            Campus Match queue active
          </span>
          <Button variant="outline" size="sm" onClick={openCampusMatch}>
            Open
          </Button>
        </div>
      </div>
    );
  }

  if (campusMatchState.status === "in_session") {
    return (
      <div className="border-b bg-emerald-50/70 px-3 py-2 dark:bg-emerald-950/20">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" />
            Campus Match chat active with {campusMatchState.session?.partnerAlias ?? "a match"}
          </span>
          <Button variant="outline" size="sm" onClick={openCampusMatch}>
            <Ghost className="mr-1 h-4 w-4" />
            Open
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
