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
  POST_FLAIRS,
  FLAIR_COLORS,
  type CommunityPost,
  type PostComment,
  type PostFlair,
  type SortMode,
  type VoteDirection,
} from "@/lib/posts";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-3">
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
          {/* Flair filter visible only on mobile */}
          <div className="lg:hidden">
            <FlairFilter activeFlair={activeFlair} onFlairChange={setActiveFlair} />
          </div>
        </div>
      )}

      {/* Reddit-style two-column layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl gap-4 p-4">
          {/* Main feed column */}
          <div className="min-w-0 flex-1 max-w-2xl mx-auto lg:mx-0">
            {/* Welcome banner */}
            {!selectedPost && (
              <div className="mb-3 rounded-2xl bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/10 px-5 py-4">
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

          {/* Right sidebar - hidden on mobile */}
          {!selectedPost && (
            <aside className="hidden lg:flex w-72 shrink-0 flex-col gap-4">
              {/* Flair filter */}
              <div className="rounded-2xl border bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Filter by Flair</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 p-3">
                  <button onClick={() => setActiveFlair(null)} className="shrink-0">
                    <Badge variant={activeFlair === null ? "default" : "outline"}>All</Badge>
                  </button>
                  {POST_FLAIRS.map((flair) => (
                    <button
                      key={flair}
                      onClick={() => setActiveFlair(activeFlair === flair ? null : flair)}
                      className="shrink-0"
                    >
                      <Badge
                        variant={activeFlair === flair ? "default" : "outline"}
                        style={
                          activeFlair === flair
                            ? { backgroundColor: FLAIR_COLORS[flair], borderColor: FLAIR_COLORS[flair] }
                            : { borderColor: FLAIR_COLORS[flair], color: FLAIR_COLORS[flair] }
                        }
                      >
                        {flair}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              {/* Community Rules */}
              <div className="rounded-2xl border bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Community Rules</h3>
                </div>
                <ol className="flex flex-col gap-2.5 p-4 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">1.</span>
                    <span>Be respectful to fellow iskos and iskas. No personal attacks or harassment.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">2.</span>
                    <span>Keep posts relevant to UP campus life, academics, or student interests.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">3.</span>
                    <span>Use the appropriate flair for your posts so others can find them easily.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">4.</span>
                    <span>No spam, self-promotion, or repeated posting of the same content.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">5.</span>
                    <span>Do not share personal information of others without their consent.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">6.</span>
                    <span>Selling posts must include price, condition, and meet-up details.</span>
                  </li>
                </ol>
              </div>

              {/* About */}
              <div className="rounded-2xl border bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">About Community</h3>
                </div>
                <div className="flex flex-col gap-2 p-4 text-xs text-muted-foreground">
                  <p>A space for UP students to discuss campus life, share resources, ask questions, and connect with each other.</p>
                  <div className="mt-1 flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Members
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {posts.length} posts
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
