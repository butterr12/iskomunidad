"use client";

import { useState, useEffect, useMemo } from "react";
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

export function CommunityTab() {
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
