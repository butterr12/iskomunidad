import { MessageCircle } from "lucide-react";
import { CommentThread } from "./comment-thread";
import { buildCommentTree, type PostComment, type VoteDirection } from "@/lib/posts";

interface CommentSectionProps {
  comments: PostComment[];
  onVoteComment: (commentId: string, direction: VoteDirection) => void;
}

export function CommentSection({ comments, onVoteComment }: CommentSectionProps) {
  const tree = buildCommentTree(comments);

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
        </h3>
      </div>

      {/* Mock composer */}
      <div className="rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
        Add a comment...
      </div>

      {tree.length > 0 && (
        <CommentThread nodes={tree} onVoteComment={onVoteComment} />
      )}
    </div>
  );
}
