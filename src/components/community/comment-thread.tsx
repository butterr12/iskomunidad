"use client";

import { useState } from "react";
import Link from "next/link";
import { Reply, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VoteControls } from "./vote-controls";
import { MentionText } from "./mention-text";
import { MentionInput } from "./mention-input";
import { UserFlairs } from "@/components/user-flairs";
import { formatRelativeTime, type CommentNode, type VoteDirection } from "@/lib/posts";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface CommentThreadProps {
  nodes: CommentNode[];
  depth?: number;
  onVoteComment: (commentId: string, direction: VoteDirection) => void;
  onReply: (parentId: string, body: string) => Promise<void>;
  expandedThreads?: Set<string>;
  onExpandThread?: (commentId: string) => void;
}

const MAX_VISIBLE_DEPTH = 3;

function InlineReplyForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody("");
      onCancel();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex gap-2">
      <MentionInput
        placeholder="Write a reply... (use @username to tag)"
        value={body}
        onChange={setBody}
        disabled={submitting}
        containerClassName="flex-1"
        className="h-8 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button type="submit" size="icon-xs" aria-label="Submit reply" disabled={!body.trim() || submitting}>
        {submitting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Send className="h-3 w-3" />
        )}
      </Button>
      <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

export function CommentThread({ nodes, depth = 0, onVoteComment, onReply, expandedThreads: expandedThreadsProp, onExpandThread: onExpandThreadProp }: CommentThreadProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [ownExpanded, setOwnExpanded] = useState<Set<string>>(new Set());

  // Root instance owns state; children receive it via props
  const expandedThreads = expandedThreadsProp ?? ownExpanded;
  const onExpandThread = onExpandThreadProp ?? ((id: string) => setOwnExpanded((prev) => new Set(prev).add(id)));

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
                <Avatar className="h-5 w-5">
                  {node.comment.authorImage && <AvatarImage src={node.comment.authorImage} alt={node.comment.author} />}
                  <AvatarFallback className="text-[9px] font-medium">{getInitials(node.comment.author)}</AvatarFallback>
                </Avatar>
                {node.comment.authorHandle ? (
                  <Link href={`/profile/${node.comment.authorHandle.replace("@", "")}`} className="font-medium text-foreground hover:underline">
                    {node.comment.authorHandle}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{node.comment.author}</span>
                )}
                <UserFlairs username={node.comment.authorHandle?.replace("@", "") ?? ""} context="inline" max={1} />
                <span>·</span>
                <span>{formatRelativeTime(node.comment.createdAt)}</span>
              </div>
              <p className="text-sm">
                <MentionText text={node.comment.body} />
              </p>
              <Button
                variant="ghost"
                size="xs"
                className="w-fit gap-1 text-muted-foreground"
                onClick={() =>
                  setReplyingTo(replyingTo === node.comment.id ? null : node.comment.id)
                }
              >
                <Reply className="h-3 w-3" />
                Reply
              </Button>

              {replyingTo === node.comment.id && (
                <InlineReplyForm
                  onSubmit={(body) => onReply(node.comment.id, body)}
                  onCancel={() => setReplyingTo(null)}
                />
              )}
            </div>
          </div>

          {node.children.length > 0 && (
            depth + 1 < MAX_VISIBLE_DEPTH || expandedThreads.has(node.comment.id) ? (
              <CommentThread
                nodes={node.children}
                depth={depth + 1}
                onVoteComment={onVoteComment}
                onReply={onReply}
                expandedThreads={expandedThreads}
                onExpandThread={onExpandThread}
              />
            ) : (
              <button
                className="ml-6 mt-1 text-xs font-medium text-primary hover:underline"
                onClick={() => onExpandThread(node.comment.id)}
              >
                Continue this thread →
              </button>
            )
          )}
        </div>
      ))}
    </div>
  );
}
