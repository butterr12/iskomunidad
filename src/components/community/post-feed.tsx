import { MessageCircle } from "lucide-react";
import { PostCard } from "./post-card";
import type { CommunityPost, VoteDirection } from "@/lib/posts";

interface PostFeedProps {
  posts: CommunityPost[];
  onSelectPost: (post: CommunityPost) => void;
  onVotePost: (postId: string, direction: VoteDirection) => void;
}

export function PostFeed({ posts, onSelectPost, onVotePost }: PostFeedProps) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium">Wala pang post dito</p>
        <p className="text-xs">Be the first to start a conversation!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onSelect={() => onSelectPost(post)}
          onVote={(dir) => onVotePost(post.id, dir)}
        />
      ))}
    </div>
  );
}
