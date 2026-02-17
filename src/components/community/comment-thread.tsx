import { Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoteControls } from "./vote-controls";
import { formatRelativeTime, type CommentNode, type VoteDirection } from "@/lib/posts";
import { cn } from "@/lib/utils";

interface CommentThreadProps {
  nodes: CommentNode[];
  depth?: number;
  onVoteComment: (commentId: string, direction: VoteDirection) => void;
}

const MAX_VISIBLE_DEPTH = 3;

export function CommentThread({ nodes, depth = 0, onVoteComment }: CommentThreadProps) {
  return (
    <div className={cn("flex flex-col", depth > 0 && "ml-6 border-l-2 border-muted pl-3")}>
      {nodes.map((node) => (
        <div key={node.comment.id} className="py-2">
          <div className="flex gap-2">
            <VoteControls
              size="sm"
              score={node.comment.score}
              userVote={node.comment.userVote}
              onVote={(dir) => onVoteComment(node.comment.id, dir)}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{node.comment.authorHandle}</span>
                <span>·</span>
                <span>{formatRelativeTime(node.comment.createdAt)}</span>
              </div>
              <p className="text-sm">{node.comment.body}</p>
              <Button variant="ghost" size="xs" className="w-fit gap-1 text-muted-foreground">
                <Reply className="h-3 w-3" />
                Reply
              </Button>
            </div>
          </div>

          {node.children.length > 0 && (
            depth + 1 < MAX_VISIBLE_DEPTH ? (
              <CommentThread
                nodes={node.children}
                depth={depth + 1}
                onVoteComment={onVoteComment}
              />
            ) : (
              <button className="ml-6 mt-1 text-xs font-medium text-primary hover:underline">
                Continue this thread →
              </button>
            )
          )}
        </div>
      ))}
    </div>
  );
}
