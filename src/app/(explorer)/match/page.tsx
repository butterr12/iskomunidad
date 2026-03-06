"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { ArrowLeft, HeartHandshake, Heart, Settings2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MatchProfileSetup } from "@/components/match/match-profile-setup";
import { MatchSwipeDeck } from "@/components/match/match-swipe-deck";
import { LikesYouFeed } from "@/components/match/likes-you-feed";
import { MatchCelebration } from "@/components/match/match-celebration";
import {
  getActivePrompts,
  getMyMatchProfile,
  getSwipeDeck,
  getLikesYouFeed,
  getLikesYouCount,
  type MatchResult,
} from "@/actions/match";
import Link from "next/link";

type ViewState = "loading" | "setup" | "deck" | "edit";

export default function MatchPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewState>("loading");
  const [tab, setTab] = useState<"discover" | "likes">("discover");
  const [matchResult, setMatchResult] = useState<{
    matchId: string;
    sessionId: string;
  } | null>(null);

  // Fetch prompts
  const { data: promptsData } = useQuery({
    queryKey: ["match-prompts"],
    queryFn: async () => {
      const res = await getActivePrompts();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!session?.user,
  });

  // Fetch profile
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["match-profile"],
    queryFn: async () => {
      const res = await getMyMatchProfile();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!session?.user,
  });

  // Fetch swipe deck
  const { data: deckData, isLoading: deckLoading } = useQuery({
    queryKey: ["match-deck"],
    queryFn: async () => {
      const res = await getSwipeDeck();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!profileData,
  });

  // Fetch likes you
  const { data: likesData } = useQuery({
    queryKey: ["match-likes"],
    queryFn: async () => {
      const res = await getLikesYouFeed();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!profileData,
  });

  // Likes count for badge
  const { data: likesCount } = useQuery({
    queryKey: ["match-likes-count"],
    queryFn: async () => {
      const res = await getLikesYouCount();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!profileData,
    refetchInterval: 30000,
  });

  const handleMatch = useCallback(
    (result: Extract<MatchResult, { matched: true }>) => {
      setMatchResult({ matchId: result.matchId, sessionId: result.sessionId });
      queryClient.invalidateQueries({ queryKey: ["match-likes"] });
      queryClient.invalidateQueries({ queryKey: ["match-likes-count"] });
    },
    [queryClient],
  );

  const handleProfileComplete = useCallback(() => {
    setView("deck");
    queryClient.invalidateQueries({ queryKey: ["match-profile"] });
    queryClient.invalidateQueries({ queryKey: ["match-deck"] });
  }, [queryClient]);

  const handleDeckEmpty = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["match-deck"] });
  }, [queryClient]);

  if (!session?.user) {
    return (
      <div className="flex flex-1 items-center justify-center pt-12 sm:pt-14">
        <p className="text-sm text-muted-foreground">Sign in to access Campus Match</p>
      </div>
    );
  }

  const isLoading = profileLoading || !promptsData;
  const hasProfile = !!profileData;
  const showSetup = !isLoading && (!hasProfile || view === "edit");
  const showDeck = !isLoading && hasProfile && view !== "edit";

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 sm:pt-14 pb-safe-nav sm:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <HeartHandshake className="h-5 w-5 text-pink-500" />
          <h1 className="text-lg font-semibold">Campus Match</h1>
        </div>
        {hasProfile && view !== "edit" && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setView("edit")}
            aria-label="Edit profile"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {showSetup && promptsData && (
        <MatchProfileSetup
          prompts={promptsData}
          existingProfile={
            profileData
              ? { interests: profileData.profile.interests, prompts: profileData.prompts }
              : null
          }
          onComplete={handleProfileComplete}
        />
      )}

      {showDeck && (
        <>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "discover" | "likes")}
            className="flex flex-1 flex-col min-h-0"
          >
            <TabsList variant="line" className="w-full px-4 shrink-0">
              <TabsTrigger value="discover" className="gap-1.5">
                <HeartHandshake className="h-3.5 w-3.5" />
                Discover
              </TabsTrigger>
              <TabsTrigger value="likes" className="gap-1.5">
                <Heart className="h-3.5 w-3.5" />
                Likes You
                {(likesCount ?? 0) > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                    {likesCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discover" className="flex-1 overflow-y-auto mt-0">
              {deckLoading ? (
                <div className="flex flex-1 items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : deckData ? (
                <MatchSwipeDeck
                  cards={deckData.cards}
                  swipesRemaining={deckData.swipesRemaining}
                  swipeLimit={deckData.swipeLimit}
                  onMatch={handleMatch}
                  onDeckEmpty={handleDeckEmpty}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="likes" className="flex-1 overflow-y-auto mt-0">
              {likesData ? (
                <LikesYouFeed
                  cards={likesData.cards}
                  onMatch={handleMatch}
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Match celebration */}
      <MatchCelebration
        open={!!matchResult}
        onOpenChange={(open) => !open && setMatchResult(null)}
        sessionId={matchResult?.sessionId ?? ""}
      />
    </div>
  );
}
