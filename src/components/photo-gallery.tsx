"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LandmarkPhoto } from "@/lib/landmarks";

interface PhotoGalleryProps {
  photos: LandmarkPhoto[];
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Reset index and show loading when photos change (switching landmarks)
  useEffect(() => {
    setCurrentIndex(0);
    setLoading(true);
  }, [photos]);

  // Show loading when switching between photos within the same landmark
  const handleIndexChange = (newIndex: number) => {
    setLoading(true);
    setCurrentIndex(newIndex);
  };

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

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <img
          src={current.resolvedUrl}
          alt={current.caption || "Photo"}
          className={`h-full w-full object-cover transition-opacity duration-200 ${loading ? "opacity-0" : "opacity-100"}`}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
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

      {current.source === "google_places" && current.attribution && (
        <p
          className="mt-1 text-[10px] text-muted-foreground/70"
          dangerouslySetInnerHTML={{ __html: current.attribution }}
        />
      )}

      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1">
          {photos.map((_, i) => (
            <button
              key={i}
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
