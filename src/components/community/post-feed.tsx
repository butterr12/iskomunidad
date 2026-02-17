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
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <p className="text-sm">No posts found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
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
