"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ImagePlus, Loader2 } from "lucide-react";
import { compressImageForUpload } from "@/lib/image-compression";
import {
  ALLOWED_IMAGE_TYPES_LABEL,
  IMAGE_UPLOAD_ACCEPT,
  isAllowedImageType,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-upload";

export interface UploadedPhoto {
  key: string;
  previewUrl: string;
  caption: string;
}

interface PhotoUploadProps {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  maxPhotos?: number;
}

export function PhotoUpload({
  photos,
  onChange,
  maxPhotos = 5,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousPreviewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const currentUrls = photos.map((photo) => photo.previewUrl);
    for (const previousUrl of previousPreviewUrlsRef.current) {
      if (
        previousUrl.startsWith("blob:") &&
        !currentUrls.includes(previousUrl)
      ) {
        URL.revokeObjectURL(previousUrl);
      }
    }
    previousPreviewUrlsRef.current = currentUrls;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const previewUrl of previousPreviewUrlsRef.current) {
        if (previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      }
    };
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const remaining = maxPhotos - photos.length;
      const toUpload = files.slice(0, remaining);

      setUploading(true);
      setError(null);
      try {
        const newPhotos: UploadedPhoto[] = [];
        for (const originalFile of toUpload) {
          if (!isAllowedImageType(originalFile.type)) {
            throw new Error(`Only ${ALLOWED_IMAGE_TYPES_LABEL} images are supported`);
          }

          const file = await compressImageForUpload(originalFile);
          if (file.size > MAX_UPLOAD_BYTES) {
            throw new Error("Image is still over 5MB after compression");
          }

          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Upload failed");
          }

          const { key } = await res.json();
          newPhotos.push({
            key,
            previewUrl: URL.createObjectURL(file),
            caption: "",
          });
        }
        onChange([...photos, ...newPhotos]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [photos, onChange, maxPhotos],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = photos.filter((_, i) => i !== index);
      onChange(updated);
    },
    [photos, onChange],
  );

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={photo.key} className="relative aspect-square">
              <Image
                src={photo.previewUrl}
                alt={`Photo ${i + 1}`}
                fill
                unoptimized
                sizes="(max-width: 640px) 33vw, 128px"
                className="rounded-md object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < maxPhotos && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_UPLOAD_ACCEPT}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Add Photos"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            {photos.length}/{maxPhotos} photos. Max 5MB each, auto-compressed.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
