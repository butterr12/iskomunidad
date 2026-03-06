import type { Metadata } from "next";
import { EditPostPageClient } from "./client";

export const metadata: Metadata = {
  title: "Edit Post",
  description: "Update your post.",
  robots: { index: false },
};

export default function EditPostPage() {
  return <EditPostPageClient />;
}
