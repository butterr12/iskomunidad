"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LandmarkPhoto } from "@/lib/landmarks";

interface PhotoGalleryProps {
  photos: LandmarkPhoto[];
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [loadedPhotoUrl, setLoadedPhotoUrl] = useState<string | null>(null);

  const currentIndex = useMemo(() => {
    if (photos.length === 0) return 0;
    if (!selectedPhotoId) return 0;
    const index = photos.findIndex((photo) => photo.id === selectedPhotoId);
    return index >= 0 ? index : 0;
  }, [photos, selectedPhotoId]);

  if (photos.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-muted">
        <div className="text-center text-muted-foreground">
          <Camera className="mx-auto h-8 w-8" />
          <p className="mt-1 text-sm">No photos yet</p>
        </div>
      </div>
    );
  }

  const current = photos[currentIndex];
  const isLoading = loadedPhotoUrl !== current.resolvedUrl;
  const attributionText =
    current.source === "google_places" && current.attribution
      ? current.attribution.replace(/<[^>]+>/g, "").trim()
      : null;

  const handleIndexChange = (newIndex: number) => {
    const next = photos[newIndex];
    if (!next) return;
    setSelectedPhotoId(next.id);
  };

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <Image
          src={current.resolvedUrl}
          alt={current.caption || "Photo"}
          fill
          unoptimized
          sizes="(max-width: 640px) 100vw, 640px"
          className={`object-cover transition-opacity duration-200 ${isLoading ? "opacity-0" : "opacity-100"}`}
          onLoad={() => setLoadedPhotoUrl(current.resolvedUrl)}
          onError={() => setLoadedPhotoUrl(current.resolvedUrl)}
        />

        {photos.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
              onClick={() =>
                handleIndexChange(
                  currentIndex === 0 ? photos.length - 1 : currentIndex - 1,
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
              onClick={() =>
                handleIndexChange(
                  currentIndex === photos.length - 1 ? 0 : currentIndex + 1,
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {photos.length > 1 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
            {currentIndex + 1} / {photos.length}
          </div>
        )}
      </div>

      {current.caption && (
        <p className="mt-1 text-xs text-muted-foreground">
          {current.caption}
        </p>
      )}

      {attributionText && (
        <p className="mt-1 text-[10px] text-muted-foreground/70">{attributionText}</p>
      )}

      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === currentIndex
                  ? "bg-foreground"
                  : "bg-muted-foreground/30"
              }`}
              onClick={() => handleIndexChange(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
