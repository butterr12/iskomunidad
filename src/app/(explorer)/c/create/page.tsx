import { Suspense } from "react";
import type { Metadata } from "next";
import { CreatePostPageClient } from "./client";

export const metadata: Metadata = {
  title: "Create Post",
  description: "Share something with the community.",
  robots: { index: false },
};

export default function CreatePostPage() {
  return (
    <Suspense>
      <CreatePostPageClient />
    </Suspense>
  );
}
