"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, MessageCircle } from "lucide-react";
import { SortToggle } from "./sort-toggle";
import { FlairFilter } from "./flair-filter";
import { PostFeed } from "./post-feed";
import { PostDetail } from "./post-detail";
import {
  sortPosts,
  buildCommentTree,
  type CommunityPost,
  type PostComment,
  type PostFlair,
  type SortMode,
  type VoteDirection,
} from "@/lib/posts";
import { getApprovedPosts, getPostById, voteOnPost, voteOnComment, createComment } from "@/actions/posts";

interface CommunityTabProps {
  onViewOnMap: (post: CommunityPost) => void;
}

export function CommunityTab({ onViewOnMap }: CommunityTabProps) {
  const [sortMode, setSortMode] = useState<SortMode>("hot");
  const [activeFlair, setActiveFlair] = useState<PostFlair | null>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);

  useEffect(() => {
    getApprovedPosts({ sort: sortMode }).then((res) => {
      if (res.success) setPosts(res.data as CommunityPost[]);
    });
  }, [sortMode]);

  const filteredAndSorted = useMemo(() => {
    const filtered = activeFlair
      ? posts.filter((p) => p.flair === activeFlair)
      : posts;
    return sortPosts(filtered, sortMode);
  }, [posts, activeFlair, sortMode]);

  const handleVotePost = async (postId: string, direction: VoteDirection) => {
    const res = await voteOnPost(postId, direction);
    if (res.success) {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const updated = { ...p, score: res.data.newScore, userVote: direction };
          if (selectedPost?.id === postId) {
            setSelectedPost(updated);
          }
          return updated;
        })
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
    // Fetch comments for this post
    const res = await getPostById(post.id);
    if (res.success) {
      const data = res.data as any;
      setComments(data.comments ?? []);
    }
  };

  const handleViewOnMap = () => {
    if (selectedPost) {
      onViewOnMap(selectedPost);
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
            onViewOnMap={selectedPost.locationId ? handleViewOnMap : undefined}
          />
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
