/* eslint-disable */
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload, type UploadedPhoto } from "@/components/admin/photo-upload";
import { POST_FLAIRS, FLAIR_COLORS, type PostFlair } from "@/lib/posts";

interface CreatePostFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptName?: string;
  onSubmit: (data: {
    title: string;
    flair: string;
    body?: string;
    linkUrl?: string;
    imageKeys?: string[];
  }) => Promise<{ success: boolean }>;
}

export function CreatePostForm({ open, onOpenChange, promptName, onSubmit }: CreatePostFormProps) {
  const [title, setTitle] = useState("");
  const [flair, setFlair] = useState<PostFlair | "">("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim() && flair && !submitting;
  const titlePlaceholder = promptName?.trim()
    ? `What's on your mind, ${promptName.trim()}?`
    : "What's on your mind?";

  function reset() {
    setTitle("");
    setFlair("");
    setBody("");
    setLinkUrl("");
    setPhotos([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const imageKeys = photos.map((p) => p.key);
      const result = await onSubmit({
        title: title.trim(),
        flair,
        body: body.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        imageKeys: imageKeys.length > 0 ? imageKeys : undefined,
      });
      if (result.success) {
        reset();
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create a Post</DialogTitle>
          <DialogDescription>Share something with the community</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="post-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="post-title"
              placeholder={titlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Flair */}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Flair</p>
            <div className="flex flex-wrap gap-1.5">
              {POST_FLAIRS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFlair(f)}
                >
                  <Badge
                    variant={flair === f ? "default" : "outline"}
                    style={
                      flair === f
                        ? { backgroundColor: FLAIR_COLORS[f], borderColor: FLAIR_COLORS[f] }
                        : { borderColor: FLAIR_COLORS[f], color: FLAIR_COLORS[f] }
                    }
                    className="cursor-pointer"
                  >
                    {f}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="post-body" className="text-sm font-medium">
              Body <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="post-body"
              placeholder="Write your post..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </div>

          {/* Link URL */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="post-link" className="text-sm font-medium">
              Link <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              id="post-link"
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </div>

          {/* Images */}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">
              Images <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <PhotoUpload
              photos={photos}
              onChange={setPhotos}
              maxPhotos={4}
            />
          </div>
        </form>

        {/* Submit button */}
        <div className="border-t pt-3">
          <Button
            type="button"
            disabled={!canSubmit}
            className="w-full"
            onClick={(e) => {
              const form = (e.target as HTMLElement).closest("[data-slot='dialog-content']")?.querySelector("form");
              form?.requestSubmit();
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              "Post"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
