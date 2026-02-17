"use client";

import { useReducer } from "react";
import { PostTable } from "@/components/admin/post-table";
import { getPosts, approvePost, rejectPost, deletePost } from "@/lib/admin-store";

export default function AllPostsPage() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const posts = getPosts();

  const handleApprove = (id: string) => {
    approvePost(id);
    rerender();
  };

  const handleReject = (id: string, reason: string) => {
    rejectPost(id, reason);
    rerender();
  };

  const handleDelete = (id: string) => {
    deletePost(id);
    rerender();
  };

  return (
    <PostTable
      posts={posts}
      onApprove={handleApprove}
      onReject={handleReject}
      onDelete={handleDelete}
    />
  );
}
