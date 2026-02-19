"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocalDismiss } from "@/hooks/use-local-dismiss";

const STORAGE_KEY = "iskomunidad:beta-badge-dismissed";

export function BetaBadge() {
  const [isDismissed, dismiss] = useLocalDismiss(STORAGE_KEY);

  if (isDismissed) return null;

  return (
    <Badge
      variant="outline"
      className="ml-1.5 gap-0.5 border-blue-500/30 px-1.5 py-0 text-[10px] uppercase tracking-wider text-blue-500"
    >
      Beta
      <button
        type="button"
        aria-label="Dismiss beta badge"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          dismiss();
        }}
        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-blue-500/10"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </Badge>
  );
}
