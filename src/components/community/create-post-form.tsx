"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { POST_FLAIRS, FLAIR_COLORS, type PostFlair, type PostType } from "@/lib/posts";

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "link", label: "Link" },
  { value: "image", label: "Image" },
];

const EMOJI_OPTIONS = ["🎓", "📚", "🏫", "🎉", "💡", "🔥", "❤️", "😂", "🤔", "📢", "🛒", "⚡"];
const COLOR_OPTIONS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#ef4444", "#06b6d4", "#f97316"];

interface CreatePostFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptName?: string;
  onSubmit: (data: {
    title: string;
    flair: string;
    type: PostType;
    body?: string;
    linkUrl?: string;
    imageEmoji?: string;
    imageColor?: string;
  }) => Promise<void>;
}

export function CreatePostForm({ open, onOpenChange, promptName, onSubmit }: CreatePostFormProps) {
  const [title, setTitle] = useState("");
  const [flair, setFlair] = useState<PostFlair | "">("");
  const [type, setType] = useState<PostType>("text");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageEmoji, setImageEmoji] = useState("🎓");
  const [imageColor, setImageColor] = useState("#3b82f6");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim() && flair && !submitting;
  const titlePlaceholder = promptName?.trim()
    ? `What's on your mind, ${promptName.trim()}?`
    : "What's on your mind?";

  function reset() {
    setTitle("");
    setFlair("");
    setType("text");
    setBody("");
    setLinkUrl("");
    setImageEmoji("🎓");
    setImageColor("#3b82f6");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        flair,
        type,
        body: type === "text" ? body.trim() || undefined : undefined,
        linkUrl: type === "link" ? linkUrl.trim() || undefined : undefined,
        imageEmoji: type === "image" ? imageEmoji : undefined,
        imageColor: type === "image" ? imageColor : undefined,
      });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] flex flex-col rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Create a Post</SheetTitle>
          <SheetDescription>Share something with the community</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
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
            <label className="text-sm font-medium">Flair</label>
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

          {/* Post type toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-1">
              {POST_TYPES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  variant={type === t.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Type-specific fields */}
          {type === "text" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="post-body" className="text-sm font-medium">
                Body
              </label>
              <Textarea
                id="post-body"
                placeholder="Write your post..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {type === "link" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="post-link" className="text-sm font-medium">
                URL
              </label>
              <Input
                id="post-link"
                type="url"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
          )}

          {type === "image" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Emoji</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setImageEmoji(e)}
                      className={`flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-colors ${
                        imageEmoji === e
                          ? "border-primary bg-primary/10"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Background Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setImageColor(c)}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        imageColor === c ? "scale-110 border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              {/* Preview */}
              <div
                className="flex h-32 items-center justify-center rounded-lg text-5xl"
                style={{ backgroundColor: imageColor }}
              >
                {imageEmoji}
              </div>
            </div>
          )}

        </form>

        {/* Sticky submit button outside scrollable area */}
        <div className="border-t px-4 py-3">
          <Button
            type="button"
            disabled={!canSubmit}
            className="w-full"
            onClick={(e) => {
              // Programmatically submit the form
              const form = (e.target as HTMLElement).closest("[data-slot='sheet-content']")?.querySelector("form");
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
      </SheetContent>
    </Sheet>
  );
}
