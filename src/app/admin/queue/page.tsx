"use client";

import { useState, useEffect } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { ModerationRow } from "@/components/admin/moderation-row";
import { adminGetAllPosts, adminApprovePost, adminRejectPost } from "@/actions/admin";

export default function ModerationQueuePage() {
  const [draftPosts, setDraftPosts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrafts = async () => {
    const res = await adminGetAllPosts("draft");
    if (res.success) setDraftPosts(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchDrafts(); }, []);

  const handleApprove = async (id: string) => {
    await adminApprovePost(id);
    fetchDrafts();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectPost(id, reason);
    fetchDrafts();
  };

  if (loading) {
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
          <Inbox className="h-10 w-10 mb-2" />
          <p>No posts pending review.</p>
        </div>
      ) : (
        draftPosts.map((post: any) => (
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
