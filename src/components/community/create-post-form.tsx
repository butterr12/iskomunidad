/* eslint-disable */
"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload, type UploadedPhoto } from "@/components/admin/photo-upload";
import { MentionInput } from "@/components/community/mention-input";
import { TagInput } from "@/components/shared/tag-input";
import { POST_FLAIRS, FLAIR_COLORS, type PostFlair } from "@/lib/posts";
import { getApprovedEvents } from "@/actions/events";
import { getTagSuggestions } from "@/actions/tags";
import type { CampusEvent } from "@/lib/events";

export interface PostFormValues {
  title: string;
  flair: string;
  body?: string;
  linkUrl?: string;
  imageKeys?: string[];
  eventId?: string | null;
  tags: string[];
}

// ─── PostFormInner — reusable form fields + state ─────────────────────────────

interface PostFormInnerProps {
  promptName?: string;
  initialValues?: Partial<PostFormValues>;
  submitLabel?: string;
  onSubmit: (data: PostFormValues) => Promise<{ success: boolean }>;
  onSaveDraft?: (data: PostFormValues) => Promise<{ success: boolean }>;
  onClose?: () => void;
  autoSaveStatus?: ReactNode;
  /** Called on every meaningful form change (for autosave) */
  onFormChange?: (data: PostFormValues) => void;
}

export function PostFormInner({
  promptName,
  initialValues,
  submitLabel,
  onSubmit,
  onSaveDraft,
  onClose,
  autoSaveStatus,
  onFormChange,
}: PostFormInnerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [flair, setFlair] = useState<PostFlair | "">((initialValues?.flair as PostFlair) ?? "");
  const [body, setBody] = useState(initialValues?.body ?? "");
  const [linkUrl, setLinkUrl] = useState(initialValues?.linkUrl ?? "");
  const [eventId, setEventId] = useState<string | null>(initialValues?.eventId ?? null);
  const [tags, setTags] = useState<string[]>(initialValues?.tags ?? []);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CampusEvent[]>([]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>(
    initialValues?.imageKeys?.map((key) => ({
      key,
      previewUrl: `/api/photos/${key}`,
      caption: "",
    })) ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    getApprovedEvents().then((res) => {
      if (res.success) setUpcomingEvents(res.data as CampusEvent[]);
    });
    getTagSuggestions().then((res) => {
      if (res.success) setTagSuggestions(res.data);
    });
  }, []);

  function collectData(): PostFormValues {
    return {
      title: title.trim(),
      flair,
      body: body.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
      imageKeys: photos.length > 0 ? photos.map((p) => p.key) : undefined,
      eventId: eventId || null,
      tags,
    };
  }

  // Notify parent of changes for autosave
  useEffect(() => {
    onFormChange?.(collectData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, flair, body, linkUrl, eventId, tags, photos]);

  const canSubmit = title.trim() && flair && !submitting && !savingDraft;
  const titlePlaceholder = promptName?.trim()
    ? `What's on your mind, ${promptName.trim()}?`
    : "What's on your mind?";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await onSubmit(collectData());
      if (result.success) {
        onClose?.();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    if (!canSubmit || !onSaveDraft) return;
    setSavingDraft(true);
    try {
      const result = await onSaveDraft(collectData());
      if (result.success) {
        onClose?.();
      }
    } finally {
      setSavingDraft(false);
    }
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
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

        {/* Tag Event */}
        {upcomingEvents.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">
              Tag Event <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <Select value={eventId ?? "none"} onValueChange={(v) => setEventId(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {upcomingEvents.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Body */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="post-body" className="text-sm font-medium">
            Body <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <MentionInput
            id="post-body"
            multiline
            placeholder="Write your post... (use @username to tag someone)"
            value={body}
            onChange={setBody}
            rows={4}
          />
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Tags <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            {tags.length > 0 && (
              <span className="text-xs text-muted-foreground">{tags.length}/10</span>
            )}
          </div>
          <TagInput
            value={tags}
            onChange={setTags}
            suggestions={tagSuggestions}
            placeholder="#academic, #tips…"
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

      {/* Action buttons */}
      <div className="border-t pt-3 flex items-center gap-2">
        {autoSaveStatus && <div className="mr-auto">{autoSaveStatus}</div>}
        {onSaveDraft && !autoSaveStatus && (
          <Button
            type="button"
            variant="outline"
            disabled={!canSubmit}
            className="flex-1"
            onClick={handleSaveDraft}
          >
            {savingDraft ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Draft"
            )}
          </Button>
        )}
        <Button
          type="button"
          disabled={!canSubmit}
          className={!onSaveDraft && !autoSaveStatus ? "w-full" : "flex-1"}
          onClick={() => formRef.current?.requestSubmit()}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {submitLabel ? `${submitLabel}...` : "Posting..."}
            </>
          ) : (
            submitLabel ?? "Post"
          )}
        </Button>
      </div>
    </>
  );
}

// ─── CreatePostForm — Dialog wrapper (backward compat) ────────────────────────

interface CreatePostFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptName?: string;
  initialValues?: Partial<PostFormValues>;
  submitLabel?: string;
  onSubmit: (data: PostFormValues) => Promise<{ success: boolean }>;
  onSaveDraft?: (data: PostFormValues) => Promise<{ success: boolean }>;
}

export function CreatePostForm({
  open,
  onOpenChange,
  promptName,
  initialValues,
  submitLabel,
  onSubmit,
  onSaveDraft,
}: CreatePostFormProps) {
  // Reset key forces re-mount of inner form when dialog opens with different data
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (open) setFormKey((k) => k + 1);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {initialValues ? "Edit Post" : "Create a Post"}
          </DialogTitle>
          <DialogDescription>
            {initialValues ? "Update your post" : "Share something with the community"}
          </DialogDescription>
        </DialogHeader>

        <PostFormInner
          key={formKey}
          promptName={!initialValues ? promptName : undefined}
          initialValues={initialValues}
          submitLabel={submitLabel}
          onSubmit={onSubmit}
          onSaveDraft={onSaveDraft}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
