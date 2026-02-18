"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import {
  getOrCreateConversation,
  getConversations,
  type ConversationPreview,
} from "@/actions/messages";
import { ConversationList } from "@/components/messages/conversation-list";
import { ChatPanel } from "@/components/messages/chat-panel";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const withUserId = searchParams.get("with");

  const [activeConversation, setActiveConversation] =
    useState<ConversationPreview | null>(null);
  const [initializing, setInitializing] = useState(false);

  // Fetch conversations for auto-open via ?with= param
  const { data: conversationsData } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await getConversations();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const allConversations = useMemo(
    () => [
      ...(conversationsData?.messages ?? []),
      ...(conversationsData?.requests ?? []),
    ],
    [conversationsData?.messages, conversationsData?.requests],
  );

  // Handle ?with= param — auto-create or find conversation
  useEffect(() => {
    if (!withUserId || !session?.user || initializing) return;

    async function openConversation() {
      setInitializing(true);
      const res = await getOrCreateConversation(withUserId!);
      if (res.success) {
        // Find this conversation in the list, or refetch
        const found = allConversations.find((c) => c.id === res.data.conversationId);
        if (found) {
          setActiveConversation(found);
        } else {
          // The conversation is new, refetch and find it
          const freshRes = await getConversations();
          if (freshRes.success) {
            const allFresh = [
              ...freshRes.data.messages,
              ...freshRes.data.requests,
            ];
            const freshFound = allFresh.find(
              (c) => c.id === res.data.conversationId,
            );
            if (freshFound) setActiveConversation(freshFound);
          }
        }
      }
      setInitializing(false);
    }

    void openConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withUserId, session?.user?.id]);

  // Keep active conversation in sync with refreshed list data.
  useEffect(() => {
    if (!activeConversation) return;
    const latest = allConversations.find((c) => c.id === activeConversation.id);
    if (!latest) return;
    if (
      latest.updatedAt !== activeConversation.updatedAt ||
      latest.requestStatus !== activeConversation.requestStatus ||
      latest.unreadCount !== activeConversation.unreadCount
    ) {
      setActiveConversation(latest);
    }
  }, [
    activeConversation,
    allConversations,
  ]);

  if (!session?.user) {
    return (
      <div className="flex flex-1 items-center justify-center pt-12 sm:pt-14">
        <p className="text-sm text-muted-foreground">
          Sign in to access messages
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      {/* Sidebar — conversation list */}
      <div
        className={cn(
          "border-r flex-col",
          activeConversation
            ? "hidden sm:flex sm:w-80"
            : "flex w-full sm:w-80",
        )}
      >
        <ConversationList
          activeConversationId={activeConversation?.id ?? null}
          onSelect={setActiveConversation}
        />
      </div>

      {/* Chat panel */}
      <div
        className={cn(
          "flex-1 flex-col min-w-0",
          activeConversation ? "flex" : "hidden sm:flex",
        )}
      >
        {activeConversation ? (
          <ChatPanel
            key={activeConversation.id}
            conversation={activeConversation}
            onBack={() => setActiveConversation(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium">Select a conversation</p>
              <p className="mt-1 text-xs">
                Choose from your existing conversations or start a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
