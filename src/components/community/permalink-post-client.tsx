"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  MapPin,
  MessageCircle,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { voteOnComment, voteOnPost, createComment, getPostById, toggleBookmark } from "@/actions/posts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VoteControls } from "@/components/community/vote-controls";
import { CommentSection } from "@/components/community/comment-section";
import { UserFlairs } from "@/components/user-flairs";
import { MentionText } from "@/components/community/mention-text";
import { cn } from "@/lib/utils";
import {
  FLAIR_COLORS,
  formatRelativeTime,
  type CommunityPost,
  type PostComment,
  type VoteDirection,
} from "@/lib/posts";
import { isSafeUrl } from "@/lib/validation/url";

interface PermalinkPostClientProps {
  initialPost: CommunityPost;
  initialComments: PostComment[];
  isAuthenticated: boolean;
  signInHref: string;
  canonicalShareUrl: string;
}

type PostByIdPayload = Partial<CommunityPost> & {
  comments?: PostComment[];
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PermalinkPostClient({
  initialPost,
  initialComments,
  isAuthenticated,
  signInHref,
  canonicalShareUrl,
}: PermalinkPostClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState(initialComments);

  const promptSignIn = () => {
    toast("Sign in to interact with this post.", {
      action: {
        label: "Sign in",
        onClick: () => router.push(signInHref),
      },
    });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/c");
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          url: canonicalShareUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(canonicalShareUrl);
        toast.success("Link copied to clipboard.");
        return;
      }

      toast.error("Sharing is not supported on this device.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this post.");
    }
  };

  const [bookmarkPending, setBookmarkPending] = useState(false);

  const handleToggleBookmark = async () => {
    if (!isAuthenticated) {
      promptSignIn();
      return;
    }
    if (bookmarkPending) return;

    const wasBookmarked = post.isBookmarked;
    const newState = !wasBookmarked;

    // Optimistic update
    setPost((prev) => ({ ...prev, isBookmarked: newState }));
    setBookmarkPending(true);

    try {
      const res = await toggleBookmark(post.id);
      if (!res.success) {
        // Revert on failure
        setPost((prev) => ({ ...prev, isBookmarked: wasBookmarked }));
        toast.error(res.error);
        if (res.error === "Not authenticated") router.push(signInHref);
      } else {
        // Reconcile from server truth
        setPost((prev) => ({ ...prev, isBookmarked: res.data.isBookmarked }));
        queryClient.invalidateQueries({ queryKey: ["saved-posts"] });
      }
    } finally {
      setBookmarkPending(false);
    }
  };

  const handleVotePost = async (direction: VoteDirection) => {
    if (!isAuthenticated) {
      promptSignIn();
      return;
    }

    const res = await voteOnPost(post.id, direction);
    if (!res.success) {
      toast.error(res.error);
      if (res.error === "Not authenticated") router.push(signInHref);
      return;
    }

    setPost((prev) => ({
      ...prev,
      score: res.data.newScore,
      userVote: direction,
    }));
  };

  const handleVoteComment = async (commentId: string, direction: VoteDirection) => {
    if (!isAuthenticated) {
      promptSignIn();
      return;
    }

    const res = await voteOnComment(commentId, direction);
    if (!res.success) {
      toast.error(res.error);
      if (res.error === "Not authenticated") router.push(signInHref);
      return;
    }

    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? { ...comment, score: res.data.newScore, userVote: direction }
          : comment,
      ),
    );
  };

  const refreshFromServer = async () => {
    const res = await getPostById(post.id);
    if (!res.success) return;

    const latest = res.data as PostByIdPayload;
    setComments(latest.comments ?? []);
    setPost((prev) => ({
      ...prev,
      commentCount: latest.commentCount ?? prev.commentCount,
      score: latest.score ?? prev.score,
      userVote: (latest.userVote as VoteDirection | undefined) ?? prev.userVote,
      isBookmarked: (latest.isBookmarked as boolean | undefined) ?? prev.isBookmarked,
    }));
  };

  const handleComment = async (body: string) => {
    if (!isAuthenticated) {
      promptSignIn();
      return;
    }

    const res = await createComment({ postId: post.id, body });
    if (!res.success) {
      toast.error(res.error);
      if (res.error === "Not authenticated") router.push(signInHref);
      return;
    }

    await refreshFromServer();
  };

  const handleReply = async (parentId: string, body: string) => {
    if (!isAuthenticated) {
      promptSignIn();
      return;
    }

    const res = await createComment({ postId: post.id, parentId, body });
    if (!res.success) {
      toast.error(res.error);
      if (res.error === "Not authenticated") router.push(signInHref);
      return;
    }

    await refreshFromServer();
  };

  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col overflow-y-auto bg-background pt-2 pb-6 sm:pt-6">
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 border-b px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex gap-3">
          <VoteControls
            score={post.score}
            userVote={post.userVote}
            onVote={handleVotePost}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-xl font-semibold leading-tight">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                style={{ borderColor: FLAIR_COLORS[post.flair], color: FLAIR_COLORS[post.flair] }}
              >
                {post.flair}
              </Badge>
              <Avatar className="h-5 w-5">
                {post.authorImage && <AvatarImage src={post.authorImage} alt={post.author} />}
                <AvatarFallback className="text-[9px] font-medium">
                  {getInitials(post.author)}
                </AvatarFallback>
              </Avatar>
              {post.authorHandle ? (
                <Link href={`/profile/${post.authorHandle.replace("@", "")}`} className="hover:underline">
                  {post.authorHandle}
                </Link>
              ) : (
                <span>{post.author}</span>
              )}
              <UserFlairs username={post.authorHandle?.replace("@", "") ?? ""} context="inline" max={2} />
              <span>·</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
            </div>
            {post.locationId && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>Location pinned</span>
              </div>
            )}
          </div>
        </div>

        {post.body && (
          <p className="text-sm leading-relaxed">
            <MentionText text={post.body} />
          </p>
        )}
        {post.linkUrl && isSafeUrl(post.linkUrl) && (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-primary transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{post.linkUrl}</span>
          </a>
        )}
        {post.imageKeys && post.imageKeys.length > 0 && (
          <div
            className={`grid gap-2 ${
              post.imageKeys.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {post.imageKeys.map((key, i) => (
              <div
                key={key}
                className={`relative overflow-hidden rounded-lg ${
                  post.imageKeys!.length === 1
                    ? "aspect-video"
                    : post.imageKeys!.length === 3 && i === 0
                      ? "row-span-2 aspect-square"
                      : "aspect-square"
                }`}
              >
                <Image
                  src={`/api/photos/${key}`}
                  alt={`Post image ${i + 1}`}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 600px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={bookmarkPending} onClick={handleToggleBookmark}>
            <Bookmark className={cn("h-3.5 w-3.5", post.isBookmarked && "fill-current")} />
            {post.isBookmarked ? "Saved" : "Save"}
          </Button>
          {isAuthenticated && post.locationId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/map?landmark=${post.locationId}`)}
            >
              <MapPin className="h-3.5 w-3.5" />
              View on Map
            </Button>
          )}
        </div>

        {isAuthenticated ? (
          <CommentSection
            comments={comments}
            onVoteComment={handleVoteComment}
            onComment={handleComment}
            onReply={handleReply}
          />
        ) : (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">
                {post.commentCount} {post.commentCount === 1 ? "Comment" : "Comments"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Comments are visible after signing in.
            </p>
            <div>
              <Button size="sm" onClick={() => router.push(signInHref)}>
                Sign in to view comments
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
