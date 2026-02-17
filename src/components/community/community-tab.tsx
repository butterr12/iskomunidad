"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, MessageCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SortToggle } from "./sort-toggle";
import { FlairFilter } from "./flair-filter";
import { PostFeed } from "./post-feed";
import { PostDetail } from "./post-detail";
import {
  sortPosts,
  type CommunityPost,
  type PostComment,
  type PostFlair,
  type SortMode,
  type VoteDirection,
} from "@/lib/posts";
import { getApprovedPosts, getPostById, voteOnPost, voteOnComment } from "@/actions/posts";

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
  const queryClient = useQueryClient();
  const [sortMode, setSortMode] = useState<SortMode>("hot");
  const [activeFlair, setActiveFlair] = useState<PostFlair | null>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);

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
      const data = res.data as any;
      setComments(data.comments ?? []);
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

      {/* Welcome banner */}
      {!selectedPost && (
        <div className="mx-4 mt-3 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/10 px-5 py-4">
          <p className="text-base font-semibold">What&apos;s on your mind, isko?</p>
          <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Community
            </span>
          </div>
        </div>
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
    </div>
  );
}
