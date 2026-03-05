"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getUnseenAnnouncements,
  markAnnouncementSeen,
  type Announcement,
} from "@/actions/announcements";

const QUERY_KEY = ["unseen-announcements"] as const;

export function AnnouncementModal() {
  const queryClient = useQueryClient();
  const [imgError, setImgError] = useState(false);

  const { data: announcements = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await getUnseenAnnouncements();
      return res.success ? res.data : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const current = announcements[0] as Announcement | undefined;

  const handleDismiss = () => {
    if (!current) return;
    setImgError(false);
    queryClient.setQueryData<Announcement[]>(QUERY_KEY, (old) =>
      old?.filter((a) => a.id !== current.id) ?? [],
    );
    markAnnouncementSeen(current.id).catch(() => {});
  };

  if (!current) return null;

  const showImage = !!current.imageKey && !imgError;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {showImage && (
          <div className="relative -mx-6 -mt-6 mb-4 aspect-[2/1] overflow-hidden rounded-t-lg">
            <Image
              src={`/api/photos/${current.imageKey}`}
              alt=""
              fill
              unoptimized
              className="object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}
        <DialogHeader className={showImage ? "" : "pt-0"}>
          <DialogTitle>{current.title}</DialogTitle>
          {current.body && (
            <DialogDescription className="whitespace-pre-line text-left">
              {current.body}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          {current.ctaLabel && current.ctaUrl && (
            <Button asChild>
              <a
                href={current.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleDismiss}
              >
                {current.ctaLabel}
              </a>
            </Button>
          )}
          <Button
            variant={current.ctaLabel && current.ctaUrl ? "outline" : "default"}
            onClick={handleDismiss}
            className="w-full"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
