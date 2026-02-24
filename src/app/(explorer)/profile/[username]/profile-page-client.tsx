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
} from "@/actions/follows";
import { voteOnPost, getUserDrafts, getUserPendingPosts, type DraftPost } from "@/actions/posts";
import { getUserEventsById } from "@/actions/events";
import { getUserGigsById } from "@/actions/gigs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostFeed } from "@/components/community/post-feed";
import { EventCard } from "@/components/events/event-card";
import { GigCard } from "@/components/gigs/gig-card";
import {
  ArrowLeft,
  Clock,
  FileText,
  UserPlus,
  UserMinus,
  Users,
  CalendarDays,
  Loader2,
  MessageSquare,
  Hammer,
} from "lucide-react";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import { UserFlairs } from "@/components/user-flairs";
import { BorderedAvatar } from "@/components/bordered-avatar";
import type { CommunityPost, VoteDirection } from "@/lib/posts";
import { FLAIR_COLORS, formatRelativeTime, type PostFlair } from "@/lib/posts";
import type { CampusEvent } from "@/lib/events";
import type { GigListing } from "@/lib/gigs";

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
  const posthog = usePostHog();

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

  const { data: pendingPosts = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["user-pending-posts"],
    queryFn: async () => {
      const res = await getUserPendingPosts();
      return res.success ? (res.data as CommunityPost[]) : [];
    },
    enabled: isOwnProfile && !!session?.user,
  });

  const { data: drafts = [], isLoading: draftsLoading } = useQuery({
    queryKey: ["user-drafts"],
    queryFn: async () => {
      const res = await getUserDrafts();
      return res.success ? res.data : [];
    },
    enabled: isOwnProfile && !!session?.user,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["user-events-by-id", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const res = await getUserEventsById(profile.id);
      return res.success ? (res.data as CampusEvent[]) : [];
    },
    enabled: !!profile?.id,
  });

  const { data: gigs = [], isLoading: gigsLoading } = useQuery({
    queryKey: ["user-gigs-by-id", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const res = await getUserGigsById(profile.id);
      return res.success ? (res.data as GigListing[]) : [];
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
      posthog?.capture(followStatus?.isFollowing ? "user_unfollowed" : "user_followed");
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
              <TabsTrigger value="events">
                Events {events.length > 0 && `(${events.length})`}
              </TabsTrigger>
              <TabsTrigger value="gigs">
                Gigs {gigs.length > 0 && `(${gigs.length})`}
              </TabsTrigger>
              {isOwnProfile && (
                <TabsTrigger value="pending">
                  Pending {pendingPosts.length > 0 && `(${pendingPosts.length})`}
                </TabsTrigger>
              )}
              {isOwnProfile && (
                <TabsTrigger value="drafts">
                  Drafts {drafts.length > 0 && `(${drafts.length})`}
                </TabsTrigger>
              )}
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
                  onSelectPost={(post) => router.push(`/c/${post.id}`)}
                  onVotePost={handleVotePost}
                />
              )}
            </TabsContent>

            <TabsContent value="events" className="mt-3">
              {eventsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No events yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => router.push(`/events?event=${event.id}`)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="gigs" className="mt-3">
              {gigsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                  ))}
                </div>
              ) : gigs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                  <Hammer className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No gigs posted yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {gigs.map((gig) => (
                    <GigCard
                      key={gig.id}
                      gig={gig}
                      onSelect={(g) => router.push(`/gigs?gig=${g.id}`)}
                      currentUserId={session?.user?.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {isOwnProfile && (
              <TabsContent value="pending" className="mt-3">
                {pendingLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : pendingPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                    <FileText className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No posts pending review</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pendingPosts.map((post) => (
                      <div key={post.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{post.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: FLAIR_COLORS[post.flair as PostFlair],
                                color: FLAIR_COLORS[post.flair as PostFlair],
                              }}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {post.flair}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Pending review
                            </Badge>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(post.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}
            {isOwnProfile && (
              <TabsContent value="drafts" className="mt-3">
                {draftsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : drafts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                    <FileText className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No drafts yet</p>
                    <p className="text-xs">Start writing and save for later from the community page.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(drafts as DraftPost[]).map((draft) => (
                      <div key={draft.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {draft.title || <span className="italic text-muted-foreground">(No title yet)</span>}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: FLAIR_COLORS[draft.flair as PostFlair],
                                color: FLAIR_COLORS[draft.flair as PostFlair],
                              }}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {draft.flair}
                            </Badge>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              Edited {formatRelativeTime(draft.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
