"use client";

import { useState } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MentionInput } from "./mention-input";
import { CommentThread } from "./comment-thread";
import { buildCommentTree, type PostComment, type VoteDirection } from "@/lib/posts";

interface CommentSectionProps {
  comments: PostComment[];
  onVoteComment: (commentId: string, direction: VoteDirection) => void;
  onComment: (body: string) => Promise<void>;
  onReply: (parentId: string, body: string) => Promise<void>;
}

export function CommentSection({
  comments,
  onVoteComment,
  onComment,
  onReply,
}: CommentSectionProps) {
  const tree = buildCommentTree(comments);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onComment(trimmed);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
        </h3>
      </div>

      {/* Comment composer */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <MentionInput
          placeholder="Add a comment... (use @username to tag)"
          value={body}
          onChange={setBody}
          disabled={submitting}
          containerClassName="flex-1"
        />
        <Button type="submit" size="icon" aria-label="Post comment" disabled={!body.trim() || submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>

      {tree.length > 0 && (
        <CommentThread nodes={tree} onVoteComment={onVoteComment} onReply={onReply} />
      )}
    </div>
  );
}
