"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Loader2, Plus, Clock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FLAIR_COLORS, formatRelativeTime, type PostFlair } from "@/lib/posts";
import { getUserDrafts, publishDraft, deletePost, type DraftPost } from "@/actions/posts";
import { toast } from "sonner";

interface DraftsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueEditing: (draft: DraftPost) => void;
  onNewPost: () => void;
}

function DraftCard({
  draft,
  onContinueEditing,
  onPublished,
  onDeleted,
}: {
  draft: DraftPost;
  onContinueEditing: (draft: DraftPost) => void;
  onPublished: () => void;
  onDeleted: () => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await publishDraft(draft.id);
      if (res.success) {
        const status = res.data.status;
        toast.success(status === "approved" ? "Post published!" : "Post submitted for review.");
        onPublished();
      } else {
        toast.error(res.error);
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await deletePost(draft.id);
      if (res.success) {
        toast.success("Draft deleted.");
        onDeleted();
      } else {
        toast.error(res.error);
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const flairColor = FLAIR_COLORS[draft.flair as PostFlair];

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {draft.title || <span className="italic text-muted-foreground">(No title yet)</span>}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              style={{ borderColor: flairColor, color: flairColor }}
              className="text-[10px] px-1.5 py-0"
            >
              {draft.flair}
            </Badge>
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              Edited {formatRelativeTime(draft.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      {confirmDelete ? (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm">
          <p className="flex-1 text-destructive font-medium">Delete this draft?</p>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2 text-xs"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            onClick={() => onContinueEditing(draft)}
          >
            Continue editing
          </Button>
          <Button
            size="sm"
            variant="default"
            className="flex-1 h-7 text-xs"
            disabled={publishing}
            onClick={handlePublish}
          >
            {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Publish"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function DraftsSheet({ open, onOpenChange, onContinueEditing, onNewPost }: DraftsSheetProps) {
  const queryClient = useQueryClient();

  const { data: drafts = [], isLoading, refetch } = useQuery({
    queryKey: ["user-drafts"],
    queryFn: async () => {
      const res = await getUserDrafts();
      return res.success ? res.data : [];
    },
    enabled: open,
  });

  const handlePublished = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["approved-posts"] });
    queryClient.invalidateQueries({ queryKey: ["user-draft-count"] });
  };

  const handleDeleted = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["user-draft-count"] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] flex flex-col">
        <SheetHeader className="pb-2">
          <SheetTitle>My Drafts</SheetTitle>
          <SheetDescription className="sr-only">Your saved drafts</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">No drafts yet</p>
                <p className="text-xs mt-0.5">Start writing something and save it for later.</p>
              </div>
              <Button size="sm" variant="outline" onClick={onNewPost} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Post
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-4">
              {drafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  onContinueEditing={(d) => {
                    onOpenChange(false);
                    onContinueEditing(d);
                  }}
                  onPublished={handlePublished}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
