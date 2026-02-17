"use client";

import { useState, useReducer } from "react";
import { Inbox } from "lucide-react";
import { ModerationRow } from "@/components/admin/moderation-row";
import { getPosts, approvePost, rejectPost } from "@/lib/admin-store";

export default function ModerationQueuePage() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const draftPosts = getPosts().filter((p) => p.status === "draft");

  const handleApprove = (id: string) => {
    approvePost(id);
    rerender();
  };

  const handleReject = (id: string, reason: string) => {
    rejectPost(id, reason);
    rerender();
  };

  return (
    <div className="space-y-4">
      {draftPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-2" />
          <p>No posts pending review.</p>
        </div>
      ) : (
        draftPosts.map((post) => (
          <ModerationRow
            key={post.id}
            post={post}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))
      )}
    </div>
  );
}
