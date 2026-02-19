/* eslint-disable */
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Plus, MessageCircle, Users, Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SortToggle } from "./sort-toggle";
import { FlairFilter } from "./flair-filter";
import { PostFeed } from "./post-feed";
import { PostDetail } from "./post-detail";
import { CreatePostForm } from "./create-post-form";
import {
  sortPosts,
  POST_FLAIRS,
  FLAIR_COLORS,
  type CommunityPost,
  type PostComment,
  type PostFlair,
  type PostType,
  type SortMode,
  type VoteDirection,
} from "@/lib/posts";
import {
  getApprovedPostsPaginated,
  getFollowingPosts,
  getPostById,
  voteOnPost,
  voteOnComment,
  createPost,
  createComment,
} from "@/actions/posts";
import { toast } from "sonner";

type PostWithComments = {
  comments?: PostComment[];
};

type PostPage = { posts: CommunityPost[]; hasMore: boolean };

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
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const postParam = searchParams.get("post");
  const [feedMode, setFeedMode] = useState<"all" | "following">("all");
  const [sortMode, setSortMode] = useState<SortMode>("new");
  const [activeFlair, setActiveFlair] = useState<PostFlair | null>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const user = session?.user;
  const displayUsername = (user as Record<string, unknown> | undefined)
    ?.displayUsername as string | undefined;
  const promptName = displayUsername?.trim() || user?.name?.trim() || undefined;

  // Paginated "all" feed
  const {
    data: postsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["approved-posts", sortMode, activeFlair],
    queryFn: async ({ pageParam }) => {
      const res = await getApprovedPostsPaginated({
        sort: sortMode,
        flair: activeFlair ?? undefined,
        page: pageParam,
      });
      if (!res.success) return { posts: [] as CommunityPost[], hasMore: false };
      return res.data as PostPage;
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length : undefined,
    initialPageParam: 0,
  });

  const posts = useMemo(
    () => postsData?.pages.flatMap((p) => p.posts) ?? [],
    [postsData],
  );

  // "following" feed (unchanged — fetch-all)
  const { data: followingPosts = [], isLoading: followingLoading } = useQuery({
    queryKey: ["following-posts", sortMode],
    queryFn: async () => {
      const res = await getFollowingPosts({ sort: sortMode });
      return res.success ? (res.data as CommunityPost[]) : [];
    },
    enabled: feedMode === "following" && !!user,
  });

  const displayPosts = useMemo(() => {
    if (feedMode === "following") {
      const filtered = activeFlair
        ? followingPosts.filter((p) => p.flair === activeFlair)
        : followingPosts;
      return sortPosts(filtered, sortMode);
    }
    // "all" feed: already sorted and filtered by server
    return posts;
  }, [feedMode, posts, followingPosts, activeFlair, sortMode]);

  const activePosts = feedMode === "following" ? followingPosts : posts;
  const activeLoading = feedMode === "following" ? followingLoading : isLoading;

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (feedMode !== "all" || !loadMoreRef.current || !hasNextPage) return;
    const el = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [feedMode, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleVotePost = async (postId: string, direction: VoteDirection) => {
    const res = await voteOnPost(postId, direction);
    if (res.success) {
      // Update infinite query cache
      queryClient.setQueryData(
        ["approved-posts", sortMode, activeFlair],
        (old: typeof postsData) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p: CommunityPost) => {
                if (p.id !== postId) return p;
                const updated = { ...p, score: res.data.newScore, userVote: direction };
                if (selectedPost?.id === postId) setSelectedPost(updated);
                return updated;
              }),
            })),
          };
        },
      );
      // Update following feed cache
      queryClient.setQueryData<CommunityPost[]>(
        ["following-posts", sortMode],
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

  // Auto-select post from ?post= param (e.g. notification deep-link)
  const deepLinkAttempted = useRef<string | null>(null);
  useEffect(() => {
    if (!postParam || selectedPost) return;
    const found = posts.find((p) => p.id === postParam);
    if (found) {
      void handleSelectPost(found);
      return;
    }
    // Post not in loaded pages — fetch it directly (once per postParam)
    if (!isLoading && deepLinkAttempted.current !== postParam) {
      deepLinkAttempted.current = postParam;
      void (async () => {
        const res = await getPostById(postParam);
        if (res.success) {
          const data = res.data as CommunityPost & { comments?: PostComment[] };
          setSelectedPost(data);
          setComments(data.comments ?? []);
        }
      })();
    }
  }, [postParam, posts.length, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await queryClient.invalidateQueries({ queryKey: ["following-posts"] });
      const status = (res.data as { status?: string }).status;
      toast.success(
        status === "draft"
          ? "Post submitted for review."
          : "Post published!",
      );
    } else {
      toast.error(res.error);
    }
    return { success: res.success };
  };

  const updateCommentCount = useCallback(
    (newCount: number) => {
      queryClient.setQueryData(
        ["approved-posts", sortMode, activeFlair],
        (old: typeof postsData) => {
          if (!old || !selectedPost) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p: CommunityPost) =>
                p.id === selectedPost.id ? { ...p, commentCount: newCount } : p,
              ),
            })),
          };
        },
      );
      setSelectedPost((prev) =>
        prev ? { ...prev, commentCount: newCount } : prev,
      );
    },
    [queryClient, sortMode, activeFlair, selectedPost, postsData],
  );

  const handleComment = async (body: string) => {
    if (!selectedPost) return;
    const res = await createComment({ postId: selectedPost.id, body });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const postRes = await getPostById(selectedPost.id);
    if (postRes.success) {
      const data = postRes.data as PostWithComments;
      setComments(data.comments ?? []);
      updateCommentCount((data.comments ?? []).length);
    }
  };

  const handleReply = async (parentId: string, body: string) => {
    if (!selectedPost) return;
    const res = await createComment({ postId: selectedPost.id, parentId, body });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const postRes = await getPostById(selectedPost.id);
    if (postRes.success) {
      const data = postRes.data as PostWithComments;
      setComments(data.comments ?? []);
      updateCommentCount((data.comments ?? []).length);
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      {/* Sticky sub-header */}
      {!selectedPost && (
        <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-lg font-semibold">Community</h2>
            <SortToggle sortMode={sortMode} onSortModeChange={setSortMode} />
          </div>
          {/* Feed mode tabs */}
          {user && (
            <div className="flex gap-1 px-4 pb-1.5">
              <button
                onClick={() => setFeedMode("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  feedMode === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFeedMode("following")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  feedMode === "following"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Following
              </button>
            </div>
          )}
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
              <button
                onClick={() => setShowCreatePost(true)}
                className="w-full mb-3 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/10 px-5 py-4 text-left transition-all hover:from-blue-500/20 hover:via-blue-500/10 hover:border-blue-500/20 active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold">
                    {`What's on your mind${promptName ? `, ${promptName}` : ""}?`}
                  </p>
                  <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {activePosts.length} {activePosts.length === 1 ? "post" : "posts"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Community
                    </span>
                  </div>
                </div>
              </button>
            )}

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
            ) : activeLoading ? (
              <PostFeedSkeleton />
            ) : feedMode === "following" && displayPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <Users className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No posts from people you follow</p>
                <p className="text-xs">Follow others to see their posts here!</p>
              </div>
            ) : (
              <>
                <PostFeed
                  posts={displayPosts}
                  onSelectPost={handleSelectPost}
                  onVotePost={handleVotePost}
                />
                {feedMode === "all" && hasNextPage && (
                  <div ref={loadMoreRef} className="flex justify-center py-4">
                    {isFetchingNextPage && (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
              </>
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
                      {activePosts.length} posts
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* FAB — only on feed view */}
      {!selectedPost && (
        <Button
          size="icon-lg"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-20 rounded-full shadow-lg sm:bottom-6"
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
