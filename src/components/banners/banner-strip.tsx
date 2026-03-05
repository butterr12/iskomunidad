"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { getActiveBanners, dismissBanner } from "@/actions/banners";
import type { Banner } from "@/actions/banners";

export const ACTIVE_BANNERS_QUERY_KEY = ["active-banners"] as const;

const VARIANT_STYLES: Record<string, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-100",
  warning:
    "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100",
  urgent:
    "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100",
  success:
    "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/40 dark:border-green-800 dark:text-green-100",
};

const VARIANT_CTA_STYLES: Record<string, string> = {
  info: "bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:hover:bg-blue-900 dark:text-blue-200",
  warning:
    "bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/60 dark:hover:bg-amber-900 dark:text-amber-200",
  urgent:
    "bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/60 dark:hover:bg-red-900 dark:text-red-200",
  success:
    "bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900/60 dark:hover:bg-green-900 dark:text-green-200",
};

function BannerItem({ banner }: { banner: Banner }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const variant = banner.variant;

  const handleDismiss = async () => {
    queryClient.setQueryData<Banner[]>(ACTIVE_BANNERS_QUERY_KEY, (old) =>
      old?.filter((b) => b.id !== banner.id) ?? [],
    );
    if (session) {
      await dismissBanner(banner.id);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        VARIANT_STYLES[variant] ?? VARIANT_STYLES.info,
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-snug">{banner.title}</p>
        {banner.body && (
          <p className="mt-0.5 text-[13px] opacity-80 leading-snug">
            {banner.body}
          </p>
        )}
        {banner.ctaLabel && banner.ctaUrl && (
          <a
            href={banner.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-2 inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors",
              VARIANT_CTA_STYLES[variant] ?? VARIANT_CTA_STYLES.info,
            )}
          >
            {banner.ctaLabel}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

const MAX_VISIBLE = 3;

export function BannerStrip() {
  const [expanded, setExpanded] = useState(false);
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ACTIVE_BANNERS_QUERY_KEY,
    queryFn: async () => {
      const res = await getActiveBanners();
      return res.success ? res.data : [];
    },
    staleTime: 60_000,
  });

  if (isLoading || banners.length === 0) return null;

  const hasOverflow = banners.length > MAX_VISIBLE;
  const visible = expanded ? banners : banners.slice(0, MAX_VISIBLE);
  const hiddenCount = banners.length - MAX_VISIBLE;

  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      {visible.map((b) => (
        <BannerItem key={b.id} banner={b} />
      ))}
      {hasOverflow && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              {hiddenCount} more announcement{hiddenCount > 1 ? "s" : ""}{" "}
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
