"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { PostTable } from "@/components/admin/post-table";
import { adminGetAllPosts, adminApprovePost, adminRejectPost, adminDeletePost } from "@/actions/admin";

export default function AllPostsPage() {
  const [posts, setPosts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    const res = await adminGetAllPosts();
    if (res.success) setPosts(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleApprove = async (id: string) => {
    await adminApprovePost(id);
    fetchPosts();
  };

  const handleReject = async (id: string, reason: string) => {
    await adminRejectPost(id, reason);
    fetchPosts();
  };

  const handleDelete = async (id: string) => {
    await adminDeletePost(id);
    fetchPosts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PostTable
      posts={posts as never[]}
      onApprove={handleApprove}
      onReject={handleReject}
      onDelete={handleDelete}
    />
  );
}
