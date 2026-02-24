"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getContentByTag } from "@/actions/tags";
import { voteOnPost } from "@/actions/posts";
import { PostCard } from "@/components/community/post-card";
import { GigCard } from "@/components/gigs/gig-card";
import { EventCard } from "@/components/events/event-card";
import type { CommunityPost, VoteDirection } from "@/lib/posts";
import type { GigListing } from "@/lib/gigs";
import type { CampusEvent } from "@/lib/events";

type Tab = "all" | "posts" | "gigs" | "events";

interface TagDiscoveryPageProps {
  tag: string;
}

export function TagDiscoveryPage({ tag }: TagDiscoveryPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const handleVote = async (postId: string, direction: VoteDirection) => {
    const res = await voteOnPost(postId, direction);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    queryClient.setQueryData(
      ["tag-content", tag],
      (old: { posts: CommunityPost[]; gigs: unknown[]; events: unknown[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          posts: old.posts.map((p) =>
            p.id === postId
              ? { ...p, score: res.data.newScore, userVote: direction }
              : p,
          ),
        };
      },
    );
  };

  const { data, isLoading } = useQuery({
    queryKey: ["tag-content", tag],
    queryFn: async () => {
      const res = await getContentByTag(tag);
      return res.success ? res.data : { posts: [], gigs: [], events: [] };
    },
  });

  const posts = (data?.posts ?? []) as CommunityPost[];
  const gigs = (data?.gigs ?? []) as GigListing[];
  const events = (data?.events ?? []) as CampusEvent[];

  const totalCount = posts.length + gigs.length + events.length;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All", count: totalCount },
    { id: "posts", label: "Posts", count: posts.length },
    { id: "gigs", label: "Gigs", count: gigs.length },
    { id: "events", label: "Events", count: events.length },
  ];

  return (
    <div className="flex flex-col min-h-0 flex-1 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      {/* Header */}
      <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5 min-w-0">
            <Hash className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-lg font-bold truncate">{tag}</h1>
          </div>
          {!isLoading && (
            <span className="ml-auto text-sm text-muted-foreground shrink-0">
              {totalCount} result{totalCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 mt-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {!isLoading && tab.count > 0 && (
                <span className={`text-[10px] ${activeTab === tab.id ? "opacity-80" : "opacity-60"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))
          ) : totalCount === 0 ? (
            <div className="flex flex-col items-center gap-2 pt-16 text-center text-muted-foreground">
              <Hash className="h-10 w-10 opacity-20" />
              <p className="font-medium">No content tagged #{tag}</p>
              <p className="text-sm">Be the first to use this tag!</p>
            </div>
          ) : (
            <>
              {(activeTab === "all" || activeTab === "posts") &&
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onSelect={() => router.push(`/c/${post.id}`)}
                    onVote={(dir) => handleVote(post.id, dir)}
                  />
                ))}
              {(activeTab === "all" || activeTab === "gigs") &&
                gigs.map((gig) => (
                  <GigCard
                    key={gig.id}
                    gig={gig}
                    onSelect={(g) => router.push(`/gigs?gig=${g.id}`)}
                  />
                ))}
              {(activeTab === "all" || activeTab === "events") &&
                events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={() => router.push(`/events?event=${event.id}`)}
                  />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
