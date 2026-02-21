import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { siteConfig } from "@/lib/site-config";
import {
  getApprovedPermalinkPost,
  type PermalinkPostData,
} from "@/lib/post-permalink";
import { PermalinkPostClient } from "@/components/community/permalink-post-client";
import type { CommunityPost, PostComment } from "@/lib/posts";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams =
  | Promise<{ id: string }>
  | { id: string };

type Props = {
  params: RouteParams;
};

function toPostTypes(data: PermalinkPostData): {
  post: CommunityPost;
  comments: PostComment[];
} {
  return {
    post: {
      id: data.post.id,
      title: data.post.title,
      body: data.post.body ?? undefined,
      author: data.post.author,
      authorHandle: data.post.authorHandle ?? "",
      authorImage: data.post.authorImage,
      flair: data.post.flair as CommunityPost["flair"],
      locationId: data.post.locationId ?? undefined,
      createdAt: data.post.createdAt,
      score: data.post.score,
      commentCount: data.post.commentCount,
      userVote: data.post.userVote,
      isBookmarked: data.post.isBookmarked,
      linkUrl: data.post.linkUrl ?? undefined,
      imageKeys: data.post.imageKeys,
    },
    comments: data.comments.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      author: comment.author,
      authorHandle: comment.authorHandle ?? "",
      authorImage: comment.authorImage,
      body: comment.body,
      createdAt: comment.createdAt,
      score: comment.score,
      userVote: comment.userVote,
    })),
  };
}

function buildDescription(post: PermalinkPostData["post"]): string {
  const source = post.body?.trim()
    ? post.body
    : `${post.author} shared this post in the iskomunidad community.`;
  if (source.length <= 160) return source;
  return `${source.slice(0, 157)}...`;
}

async function resolveParams(
  params: RouteParams,
): Promise<{ id: string }> {
  if (typeof (params as Promise<{ id: string }>).then === "function") {
    return (await params) as { id: string };
  }
  return params as { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await resolveParams(params);

  if (!UUID_RE.test(id)) {
    return {
      title: "Post unavailable",
      robots: { index: false, follow: false },
    };
  }

  const data = await getApprovedPermalinkPost(id);

  if (!data) {
    return {
      title: "Post unavailable",
      robots: { index: false, follow: false },
      alternates: { canonical: `/c/${id}` },
      openGraph: { url: `/c/${id}` },
    };
  }

  const description = buildDescription(data.post);
  const firstImage = data.post.imageKeys[0];
  const imageUrl = firstImage
    ? `${siteConfig.url}/api/photos/${firstImage}`
    : undefined;

  return {
    title: data.post.title,
    description,
    alternates: { canonical: `/c/${id}` },
    openGraph: {
      type: "article",
      url: `/c/${id}`,
      title: data.post.title,
      description,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: data.post.title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PostPermalinkPage({ params }: Props) {
  const { id } = await resolveParams(params);

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const data = await getApprovedPermalinkPost(id, session?.user.id);

  if (!data) {
    notFound();
  }

  const { post, comments } = toPostTypes(data);
  const signInHref = `/sign-in?next=${encodeURIComponent(`/c/${id}`)}`;
  const canonicalShareUrl = `${siteConfig.url}/c/${id}`;

  return (
    <PermalinkPostClient
      initialPost={post}
      initialComments={comments}
      isAuthenticated={!!session?.user}
      signInHref={signInHref}
      canonicalShareUrl={canonicalShareUrl}
    />
  );
}
