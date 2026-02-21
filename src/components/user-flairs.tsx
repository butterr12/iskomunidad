"use client";

import { useQuery } from "@tanstack/react-query";
import { getFlairsForUser } from "@/actions/flairs";
import { Skeleton } from "@/components/ui/skeleton";

interface UserFlairsProps {
  username: string;
  context?: "profile" | "inline";
  max?: number;
}

export function UserFlairs({ username, context = "inline", max = 3 }: UserFlairsProps) {
  const { data: flairs = [], isPending } = useQuery({
    queryKey: ["user-flairs", username],
    queryFn: async () => {
      const res = await getFlairsForUser(username);
      return res.success ? res.data : [];
    },
    enabled: !!username,
    staleTime: 60_000,
  });

  const isInline = context === "inline";

  if (isPending && username) {
    return (
      <Skeleton
        className={
          isInline
            ? "h-4 w-10 rounded-full shrink-0"
            : "h-5 w-14 rounded-full shrink-0"
        }
      />
    );
  }

  if (flairs.length === 0) return null;

  const shown = flairs.slice(0, max);
  const overflow = flairs.length - max;

  return (
    <>
      {shown.map((flair) => (
        <span
          key={flair.id}
          className={
            isInline
              ? "inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-semibold leading-4 text-white shrink-0"
              : "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shrink-0"
          }
          style={{
            backgroundColor: flair.color,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.15)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {isInline ? flair.shortLabel : flair.label}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={
            isInline
              ? "inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium leading-4 text-muted-foreground shrink-0"
              : "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground shrink-0"
          }
        >
          +{overflow}
        </span>
      )}
    </>
  );
}
