"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { PostFormInner, type PostFormValues } from "@/components/community/create-post-form";
import { CreatePageHeader } from "@/components/shared/create-page-header";
import { getPostById, updatePost } from "@/actions/posts";
import { toast } from "sonner";

interface PostData {
  id: string;
  title: string;
  flair: string;
  body?: string | null;
  linkUrl?: string | null;
  imageKeys: string[];
  tags: string[];
  userId: string;
  status: string;
}

export function EditPostPageClient() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    getPostById(id).then((res) => {
      if (!res.success) {
        setError("Post not found");
        setLoading(false);
        return;
      }
      setPost(res.data as PostData);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Post" fallbackHref="/c" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Post" fallbackHref="/c" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-lg font-medium">{error ?? "Post not found"}</p>
            <button
              onClick={() => router.push("/c")}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Back to Community
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session?.user?.id !== post.userId) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <CreatePageHeader title="Edit Post" fallbackHref="/c" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-lg font-medium">Not authorized</p>
            <p className="mt-1 text-sm text-muted-foreground">You can only edit your own posts.</p>
            <button
              onClick={() => router.push("/c")}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Back to Community
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (data: PostFormValues) => {
    const res = await updatePost(post.id, data);
    if (res.success) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["approved-posts"] }),
        queryClient.invalidateQueries({ queryKey: ["following-posts"] }),
      ]);
      toast.success("Post updated.");
      router.push("/c");
    } else {
      toast.error(res.error);
    }
    return { success: res.success };
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      <CreatePageHeader title="Edit Post" fallbackHref="/c" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4">
          <div className="rounded-2xl border bg-card shadow-sm p-6">
            <PostFormInner
              initialValues={{
                title: post.title,
                flair: post.flair,
                body: post.body ?? undefined,
                linkUrl: post.linkUrl ?? undefined,
                imageKeys: post.imageKeys,
                tags: post.tags,
              }}
              submitLabel="Save"
              onSubmit={handleSubmit}
              onClose={() => router.push("/c")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
