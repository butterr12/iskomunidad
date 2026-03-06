"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Loader2, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { PostFormInner, type PostFormValues } from "@/components/community/create-post-form";
import { AutosaveIndicator } from "@/components/community/autosave-indicator";
import { CreatePageHeader } from "@/components/shared/create-page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { FLAIR_COLORS, formatRelativeTime, type PostFlair } from "@/lib/posts";
import {
  createPost,
  getUserDrafts,
  getDraftById,
  publishDraft,
  deleteDraft,
  updatePost,
  type DraftPost,
} from "@/actions/posts";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";

export function CreatePostPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const { data: session } = useSession();
  const draftIdParam = searchParams.get("draft");

  const user = session?.user;
  const displayUsername = (user as Record<string, unknown> | undefined)
    ?.displayUsername as string | undefined;
  const promptName = displayUsername?.trim() || user?.name?.trim() || undefined;

  // Load draft if editing
  const { data: draftData, isLoading: draftLoading } = useQuery({
    queryKey: ["draft", draftIdParam],
    queryFn: async () => {
      if (!draftIdParam) return null;
      const res = await getDraftById(draftIdParam);
      return res.success ? res.data : null;
    },
    enabled: !!draftIdParam,
    staleTime: 0,
  });

  const isEditingDraft = !!draftIdParam && !!draftData;

  // Autosave
  const autosave = useAutosaveDraft({
    draftId: draftIdParam ?? null,
    enabled: !isEditingDraft, // For new posts, autosave creates drafts; for editing, we update
  });

  // For editing drafts, use a separate autosave instance that always updates
  const draftEditAutosave = useAutosaveDraft({
    draftId: draftIdParam,
    enabled: isEditingDraft,
  });

  const activeAutosave = isEditingDraft ? draftEditAutosave : autosave;

  const handleSubmit = async (data: PostFormValues) => {
    if (isEditingDraft && draftIdParam) {
      // Update draft content, then publish
      const updateRes = await updatePost(draftIdParam, data);
      if (!updateRes.success) {
        toast.error(updateRes.error);
        return { success: false };
      }
      const res = await publishDraft(draftIdParam);
      if (res.success) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["approved-posts"] }),
          queryClient.invalidateQueries({ queryKey: ["user-draft-count"] }),
          queryClient.invalidateQueries({ queryKey: ["user-drafts"] }),
        ]);
        const status = res.data.status;
        posthog?.capture("post_created", { status, from_draft: true });
        toast.success(status === "approved" ? "Post published!" : "Post submitted for review.");
        router.push("/c");
      } else {
        toast.error(res.error);
      }
      return { success: res.success };
    }

    // New post (or autosaved draft)
    const currentDraftId = autosave.currentDraftId;
    if (currentDraftId) {
      // Autosave created a draft — update and publish it
      const updateRes = await updatePost(currentDraftId, data);
      if (!updateRes.success) {
        toast.error(updateRes.error);
        return { success: false };
      }
      const res = await publishDraft(currentDraftId);
      if (res.success) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["approved-posts"] }),
          queryClient.invalidateQueries({ queryKey: ["user-draft-count"] }),
          queryClient.invalidateQueries({ queryKey: ["user-drafts"] }),
        ]);
        const status = res.data.status;
        posthog?.capture("post_created", { status, from_draft: true });
        toast.success(status === "approved" ? "Post published!" : "Post submitted for review.");
        router.push("/c");
      } else {
        toast.error(res.error);
      }
      return { success: res.success };
    }

    // Direct publish (no draft)
    const res = await createPost(data);
    if (res.success) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approved-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["following-posts"] }),
      ]);
      const status = (res.data as { status?: string }).status;
      posthog?.capture("post_created", { status });
      toast.success(status === "draft" ? "Post submitted for review." : "Post published!");
      router.push("/c");
    } else {
      toast.error(res.error);
    }
    return { success: res.success };
  };

  if (draftIdParam && draftLoading) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Draft" fallbackHref="/c" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const initialValues = draftData
    ? {
        title: draftData.title,
        flair: draftData.flair,
        body: draftData.body ?? undefined,
        linkUrl: draftData.linkUrl ?? undefined,
        imageKeys: draftData.imageKeys,
        tags: draftData.tags,
      }
    : undefined;

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      <CreatePageHeader
        title={isEditingDraft ? "Edit Draft" : "Create Post"}
        fallbackHref="/c"
        rightContent={
          <AutosaveIndicator
            status={activeAutosave.status}
            lastSavedAt={activeAutosave.lastSavedAt}
          />
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4">
          {/* Inline drafts panel for new posts */}
          {!isEditingDraft && <DraftsPanel />}

          <div className="rounded-2xl border bg-card shadow-sm p-6">
            <PostFormInner
              key={draftIdParam ?? "new"}
              promptName={!isEditingDraft ? promptName : undefined}
              initialValues={initialValues}
              submitLabel={isEditingDraft ? "Publish" : undefined}
              onSubmit={handleSubmit}
              onClose={() => router.push("/c")}
              onFormChange={activeAutosave.handleFormChange}
              autoSaveStatus={
                <AutosaveIndicator
                  status={activeAutosave.status}
                  lastSavedAt={activeAutosave.lastSavedAt}
                />
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Drafts Panel ──────────────────────────────────────────────────────

function DraftsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["user-drafts"],
    queryFn: async () => {
      const res = await getUserDrafts();
      return res.success ? res.data : [];
    },
  });

  if (isLoading || drafts.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          My Drafts ({drafts.length})
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="border-t px-4 pb-3 pt-2 flex flex-col gap-2">
          {drafts.map((draft) => (
            <DraftMiniCard
              key={draft.id}
              draft={draft}
              onEdit={() => router.push(`/c/create?draft=${draft.id}`)}
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ["user-drafts"] });
                queryClient.invalidateQueries({ queryKey: ["user-draft-count"] });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraftMiniCard({
  draft,
  onEdit,
  onDeleted,
}: {
  draft: DraftPost;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const flairColor = FLAIR_COLORS[draft.flair as PostFlair];

  const handleDelete = async () => {
    setDeleting(true);
    const res = await deleteDraft(draft.id);
    if (res.success) {
      toast.success("Draft deleted.");
      onDeleted();
    } else {
      toast.error(res.error);
    }
    setDeleting(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border p-2">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">
          {draft.title || <span className="italic text-muted-foreground">(No title)</span>}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          {draft.flair && (
            <Badge
              variant="outline"
              style={{ borderColor: flairColor, color: flairColor }}
              className="text-[10px] px-1.5 py-0"
            >
              {draft.flair}
            </Badge>
          )}
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(draft.updatedAt)}
          </span>
        </div>
      </div>
      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={onEdit}>
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-1.5 text-xs text-muted-foreground hover:text-destructive shrink-0"
        disabled={deleting}
        onClick={handleDelete}
      >
        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
