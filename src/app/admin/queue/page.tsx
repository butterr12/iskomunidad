"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2 } from "lucide-react";
import { ModerationRow } from "@/components/admin/moderation-row";
import {
  adminGetAllPosts,
  adminApprovePost,
  adminRejectPost,
} from "@/actions/admin";

type ModerationPost = Parameters<typeof ModerationRow>[0]["post"];

const DRAFT_POSTS_QUERY_KEY = ["admin-posts", "draft"] as const;

export default function ModerationQueuePage() {
  const queryClient = useQueryClient();

  const { data: draftPosts = [], isLoading } = useQuery({
    queryKey: DRAFT_POSTS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllPosts("draft");
      return res.success ? (res.data as ModerationPost[]) : [];
    },
  });

  const refreshDrafts = async () => {
    await queryClient.invalidateQueries({ queryKey: DRAFT_POSTS_QUERY_KEY });
  };

  const handleApprove = async (id: string) => {
    await adminApprovePost(id);
    await refreshDrafts();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectPost(id, reason);
    await refreshDrafts();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {draftPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="mb-2 h-10 w-10" />
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
