"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "./reject-dialog";
import { FLAIR_COLORS, formatRelativeTime, type CommunityPost } from "@/lib/posts";

interface ModerationRowProps {
  post: CommunityPost;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}

export function ModerationRow({ post, onApprove, onReject }: ModerationRowProps) {
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="font-semibold">{post.title}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                style={{ borderColor: FLAIR_COLORS[post.flair], color: FLAIR_COLORS[post.flair] }}
              >
                {post.flair}
              </Badge>
              <span>{post.author}</span>
              <span>{post.authorHandle}</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
              {post.locationId && <span>@ {post.locationId}</span>}
            </div>
            {post.body && (
              <p className="text-sm text-muted-foreground line-clamp-2">{post.body}</p>
            )}
            {post.rejectionReason && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                AI flag: {post.rejectionReason}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" className="text-green-600" onClick={() => onApprove(post.id)}>
              <Check className="mr-1 h-4 w-4" />
              Publish
            </Button>
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejectOpen(true)}>
              <X className="mr-1 h-4 w-4" />
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>

      <RejectDialog
        open={rejectOpen}
        itemTitle={post.title}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => {
          onReject(post.id, reason);
          setRejectOpen(false);
        }}
      />
    </>
  );
}
