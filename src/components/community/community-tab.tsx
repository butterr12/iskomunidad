"use client";

import { useState, useMemo } from "react";
import { SortToggle } from "./sort-toggle";
import { FlairFilter } from "./flair-filter";
import { PostFeed } from "./post-feed";
import { PostDetail } from "./post-detail";
import {
  mockComments,
  sortPosts,
  postToLandmark,
  type CommunityPost,
  type PostComment,
  type PostFlair,
  type SortMode,
  type VoteDirection,
} from "@/lib/posts";
import { getPosts } from "@/lib/admin-store";

interface CommunityTabProps {
  onViewOnMap: (post: CommunityPost) => void;
}

export function CommunityTab({ onViewOnMap }: CommunityTabProps) {
  const [sortMode, setSortMode] = useState<SortMode>("hot");
  const [activeFlair, setActiveFlair] = useState<PostFlair | null>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>(() =>
    getPosts().filter((p) => !p.status || p.status === "approved")
  );
  const [comments, setComments] = useState<PostComment[]>(mockComments);

  const filteredAndSorted = useMemo(() => {
    const filtered = activeFlair
      ? posts.filter((p) => p.flair === activeFlair)
      : posts;
    return sortPosts(filtered, sortMode);
  }, [posts, activeFlair, sortMode]);

  const handleVotePost = (postId: string, direction: VoteDirection) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const scoreDelta = direction - p.userVote;
        const updated = { ...p, score: p.score + scoreDelta, userVote: direction };
        if (selectedPost?.id === postId) {
          setSelectedPost(updated);
        }
        return updated;
      })
    );
  };

  const handleVoteComment = (commentId: string, direction: VoteDirection) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const scoreDelta = direction - c.userVote;
        return { ...c, score: c.score + scoreDelta, userVote: direction };
      })
    );
  };

  const handleSelectPost = (post: CommunityPost) => {
    const latest = posts.find((p) => p.id === post.id) ?? post;
    setSelectedPost(latest);
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedPost ? (
          <PostDetail
            post={selectedPost}
            comments={comments}
            onBack={() => setSelectedPost(null)}
            onVotePost={(dir) => handleVotePost(selectedPost.id, dir)}
            onVoteComment={handleVoteComment}
            onViewOnMap={postToLandmark(selectedPost) ? handleViewOnMap : undefined}
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
