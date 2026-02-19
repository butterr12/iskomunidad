"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PostTable } from "@/components/admin/post-table";
import {
  adminGetAllPosts,
  adminApprovePost,
  adminRejectPost,
  adminDeletePost,
} from "@/actions/admin";

type AdminPost = Parameters<typeof PostTable>[0]["posts"][number];

const POSTS_QUERY_KEY = ["admin-posts"] as const;

export default function AllPostsPage() {
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: POSTS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetAllPosts();
      return res.success ? (res.data as AdminPost[]) : [];
    },
  });

  const refreshPosts = async () => {
    await queryClient.invalidateQueries({ queryKey: POSTS_QUERY_KEY });
  };

  const handleApprove = async (id: string) => {
    const result = await adminApprovePost(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Post published");
    await refreshPosts();
  };

  const handleReject = async (id: string, reason: string) => {
    const result = await adminRejectPost(id, reason);
    if (!result.success) toast.error(result.error);
    else toast.success("Post declined");
    await refreshPosts();
  };

  const handleDelete = async (id: string) => {
    const result = await adminDeletePost(id);
    if (!result.success) toast.error(result.error);
    else toast.success("Post deleted");
    await refreshPosts();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PostTable
      posts={posts}
      onApprove={handleApprove}
      onReject={handleReject}
      onDelete={handleDelete}
    />
  );
}
