"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserProfile,
  getFollowStatus,
  followUser,
  unfollowUser,
  getUserPosts,
  type UserProfile,
  type FollowStatus,
} from "@/actions/follows";
import { voteOnPost } from "@/actions/posts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostFeed } from "@/components/community/post-feed";
import {
  ArrowLeft,
  UserPlus,
  UserMinus,
  Users,
  CalendarDays,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { UserFlairs } from "@/components/user-flairs";
import { BorderedAvatar } from "@/components/bordered-avatar";
import type { CommunityPost, VoteDirection } from "@/lib/posts";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatMemberSince(dateStr?: string | null): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton className="h-4 w-24 rounded" />
        <div className="flex gap-6">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function ProfilePageClient() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const username = params.username as string;

  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = session?.user?.username === username;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile", username],
    queryFn: async () => {
      const res = await getUserProfile(username);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const { data: followStatus, refetch: refetchFollowStatus } = useQuery({
    queryKey: ["follow-status", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const res = await getFollowStatus(profile.id);
      return res.success ? res.data : null;
    },
    enabled: !!profile?.id && !!session?.user && !isOwnProfile,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["user-posts", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const res = await getUserPosts(profile.id);
      return res.success ? (res.data as CommunityPost[]) : [];
    },
    enabled: !!profile?.id,
  });

  async function handleFollow() {
    if (!profile) return;
    setFollowLoading(true);
    const res = followStatus?.isFollowing
      ? await unfollowUser(profile.id)
      : await followUser(profile.id);

    if (res.success) {
      await refetchFollowStatus();
      await queryClient.invalidateQueries({ queryKey: ["user-profile", username] });
    } else {
      toast.error(res.error);
    }
    setFollowLoading(false);
  }

  const handleVotePost = async (postId: string, direction: VoteDirection) => {
    const res = await voteOnPost(postId, direction);
    if (res.success) {
      queryClient.setQueryData<CommunityPost[]>(
        ["user-posts", profile?.id],
        (old) =>
          old?.map((p) =>
            p.id === postId
              ? { ...p, score: res.data.newScore, userVote: direction }
              : p,
          ),
      );
    }
  };

  if (profileLoading) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl">
            <ProfileSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">Profile</h2>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium">User not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      {/* Header */}
      <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold truncate">
            {profile.displayUsername ?? profile.name}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl">
          {/* Profile header */}
          <div className="flex flex-col items-center gap-3 px-4 pt-6 pb-4">
            <BorderedAvatar border={profile.border} avatarSize={80}>
              <Avatar className="size-20">
                <AvatarImage src={profile.image ?? undefined} alt={profile.name} />
                <AvatarFallback className="text-2xl">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
            </BorderedAvatar>

            <div className="text-center">
              <p className="text-xl font-bold">{profile.name}</p>
              {profile.displayUsername && (
                <p className="text-sm text-muted-foreground">
                  @{profile.displayUsername}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <UserFlairs username={username} context="profile" max={4} />
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <CalendarDays className="mr-1 h-3 w-3" />
                Joined {formatMemberSince(profile.createdAt)}
              </Badge>
            </div>

            {/* Follow counts */}
            <div className="flex gap-6 text-sm">
              <span>
                <span className="font-semibold">{profile.followerCount}</span>{" "}
                <span className="text-muted-foreground">
                  {profile.followerCount === 1 ? "follower" : "followers"}
                </span>
              </span>
              <span>
                <span className="font-semibold">{profile.followingCount}</span>{" "}
                <span className="text-muted-foreground">following</span>
              </span>
            </div>

            {/* Follow / Edit button */}
            {session?.user && !isOwnProfile && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={followStatus?.isFollowing ? "outline" : "default"}
                  onClick={handleFollow}
                  disabled={followLoading}
                  className="min-w-[100px]"
                >
                  {followLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : followStatus?.isFollowing ? (
                    <>
                      <UserMinus className="mr-1.5 h-4 w-4" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1.5 h-4 w-4" />
                      Follow
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/messages?with=${profile.id}`)}
                >
                  <MessageSquare className="mr-1.5 h-4 w-4" />
                  Message
                </Button>
              </div>
            )}
            {isOwnProfile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/settings")}
              >
                Edit Profile
              </Button>
            )}
          </div>

          {/* Content tabs */}
          <Tabs defaultValue="posts" className="px-4 pb-4">
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="posts">
                Posts ({posts.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="posts" className="mt-3">
              {postsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                  ))}
                </div>
              ) : (
                <PostFeed
                  posts={posts}
                  onSelectPost={(post) =>
                    router.push(`/c/${post.id}`)
                  }
                  onVotePost={handleVotePost}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
