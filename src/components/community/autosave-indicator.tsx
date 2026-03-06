"use client";

import { Check, Loader2, AlertCircle } from "lucide-react";

interface AutosaveIndicatorProps {
  status: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function AutosaveIndicator({ status, lastSavedAt }: AutosaveIndicatorProps) {
  if (status === "idle" && !lastSavedAt) return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </>
      )}
      {status === "saved" && lastSavedAt && (
        <>
          <Check className="h-3 w-3 text-green-500" />
          Saved {timeAgo(lastSavedAt)}
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-3 w-3 text-destructive" />
          Unsaved changes
        </>
      )}
    </span>
  );
}
