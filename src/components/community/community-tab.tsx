"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SortToggle } from "./sort-toggle";
import { FlairFilter } from "./flair-filter";
import { PostFeed } from "./post-feed";
import { PostDetail } from "./post-detail";
import { CreatePostForm } from "./create-post-form";
import {
  sortPosts,
  type CommunityPost,
  type PostComment,
  type PostFlair,
  type PostType,
  type SortMode,
  type VoteDirection,
} from "@/lib/posts";
import {
  getApprovedPosts,
  getPostById,
  voteOnPost,
  voteOnComment,
  createPost,
  createComment,
} from "@/actions/posts";

type PostWithComments = {
  comments?: PostComment[];
};

function PostCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-6 rounded" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-3/4 rounded" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </div>
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      </div>
    </div>
  );
}

function PostFeedSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CommunityTab() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [sortMode, setSortMode] = useState<SortMode>("hot");
  const [activeFlair, setActiveFlair] = useState<PostFlair | null>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const user = session?.user;
  const displayUsername = (user as Record<string, unknown> | undefined)
    ?.displayUsername as string | undefined;
  const promptName = displayUsername?.trim() || user?.name?.trim() || undefined;

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["approved-posts", sortMode],
    queryFn: async () => {
      const res = await getApprovedPosts({ sort: sortMode });
      return res.success ? (res.data as CommunityPost[]) : [];
    },
  });

  const filteredAndSorted = useMemo(() => {
    const filtered = activeFlair
      ? posts.filter((p) => p.flair === activeFlair)
      : posts;
    return sortPosts(filtered, sortMode);
  }, [posts, activeFlair, sortMode]);

  const handleVotePost = async (postId: string, direction: VoteDirection) => {
    const res = await voteOnPost(postId, direction);
    if (res.success) {
      queryClient.setQueryData<CommunityPost[]>(
        ["approved-posts", sortMode],
        (old) =>
          old?.map((p) => {
            if (p.id !== postId) return p;
            const updated = { ...p, score: res.data.newScore, userVote: direction };
            if (selectedPost?.id === postId) setSelectedPost(updated);
            return updated;
          }),
      );
    }
  };

  const handleVoteComment = async (commentId: string, direction: VoteDirection) => {
    const res = await voteOnComment(commentId, direction);
    if (res.success) {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          return { ...c, score: res.data.newScore, userVote: direction };
        })
      );
    }
  };

  const handleSelectPost = async (post: CommunityPost) => {
    const latest = posts.find((p) => p.id === post.id) ?? post;
    setSelectedPost(latest);
    const res = await getPostById(post.id);
    if (res.success) {
      const data = res.data as PostWithComments;
      setComments(data.comments ?? []);
    }
  };

  const handleCreatePost = async (data: {
    title: string;
    flair: string;
    type: PostType;
    body?: string;
    linkUrl?: string;
    imageEmoji?: string;
    imageColor?: string;
  }) => {
    const res = await createPost(data);
    if (res.success) {
      await queryClient.invalidateQueries({ queryKey: ["approved-posts"] });
    }
  };

  const handleComment = async (body: string) => {
    if (!selectedPost) return;
    const res = await createComment({ postId: selectedPost.id, body });
    if (res.success) {
      // Re-fetch post to get updated comments
      const postRes = await getPostById(selectedPost.id);
      if (postRes.success) {
        const data = postRes.data as PostWithComments;
        setComments(data.comments ?? []);
        // Update comment count in the posts list
        queryClient.setQueryData<CommunityPost[]>(
          ["approved-posts", sortMode],
          (old) =>
            old?.map((p) =>
              p.id === selectedPost.id
                ? { ...p, commentCount: (data.comments ?? []).length }
                : p
            ),
        );
        setSelectedPost((prev) =>
          prev ? { ...prev, commentCount: (data.comments ?? []).length } : prev
        );
      }
    }
  };

  const handleReply = async (parentId: string, body: string) => {
    if (!selectedPost) return;
    const res = await createComment({ postId: selectedPost.id, parentId, body });
    if (res.success) {
      // Re-fetch post to get updated comments
      const postRes = await getPostById(selectedPost.id);
      if (postRes.success) {
        const data = postRes.data as PostWithComments;
        setComments(data.comments ?? []);
        queryClient.setQueryData<CommunityPost[]>(
          ["approved-posts", sortMode],
          (old) =>
            old?.map((p) =>
              p.id === selectedPost.id
                ? { ...p, commentCount: (data.comments ?? []).length }
                : p
            ),
        );
        setSelectedPost((prev) =>
          prev ? { ...prev, commentCount: (data.comments ?? []).length } : prev
        );
      }
    }
  };

  return (
    <div className="flex flex-1 flex-col pt-12 pb-14 sm:pt-14 sm:pb-0">
      {/* Sticky sub-header */}
      {!selectedPost && (
        <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-lg font-semibold">Community</h2>
            <SortToggle sortMode={sortMode} onSortModeChange={setSortMode} />
          </div>
          <FlairFilter activeFlair={activeFlair} onFlairChange={setActiveFlair} />
        </div>
      )}

      {/* Welcome banner — tappable to open create post */}
      {!selectedPost && (
        <button
          onClick={() => setShowCreatePost(true)}
          className="mx-4 mt-3 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 px-5 py-5 text-left transition-all hover:from-primary/20 hover:via-primary/10 hover:border-primary/30 active:scale-[0.98]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold">
              {`What's on your mind${promptName ? `, ${promptName}` : ""}?`}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tap to share with the community
            </p>
          </div>
        </button>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedPost ? (
          <PostDetail
            post={selectedPost}
            comments={comments}
            onBack={() => setSelectedPost(null)}
            onVotePost={(dir) => handleVotePost(selectedPost.id, dir)}
            onVoteComment={handleVoteComment}
            onComment={handleComment}
            onReply={handleReply}
          />
        ) : isLoading ? (
          <PostFeedSkeleton />
        ) : (
          <PostFeed
            posts={filteredAndSorted}
            onSelectPost={handleSelectPost}
            onVotePost={handleVotePost}
          />
        )}
      </div>

      {/* FAB — only on feed view */}
      {!selectedPost && (
        <Button
          size="icon-lg"
          className="fixed bottom-20 right-4 z-20 rounded-full shadow-lg sm:bottom-6"
          onClick={() => setShowCreatePost(true)}
        >
          <Plus className="h-5 w-5" />
        </Button>
      )}

      {/* Create post sheet */}
      <CreatePostForm
        open={showCreatePost}
        onOpenChange={setShowCreatePost}
        promptName={promptName}
        onSubmit={handleCreatePost}
      />
    </div>
  );
}
