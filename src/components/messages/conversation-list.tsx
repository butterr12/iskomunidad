"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getConversations, type ConversationPreview } from "@/actions/messages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserFlairs } from "@/components/user-flairs";
import { BorderedAvatar } from "@/components/bordered-avatar";
import { formatRelativeTime } from "@/lib/posts";
import { ComposeDialog } from "./compose-dialog";
import { usePrefetchUserFlairs } from "@/hooks/use-prefetch-user-flairs";

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

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationPreview;
  isActive: boolean;
  onClick: () => void;
}) {
  const lastMessagePreview = conversation.lastMessage
    ? conversation.lastMessage.imageUrl
      ? "Sent an image"
      : conversation.lastMessage.body ?? ""
    : "No messages yet";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
        isActive && "bg-muted",
      )}
    >
      <div className="relative shrink-0">
        <BorderedAvatar avatarSize={32}>
          <Avatar size="default">
            <AvatarImage
              src={conversation.otherUser.image ?? undefined}
              alt={conversation.otherUser.name}
            />
            <AvatarFallback>{getInitials(conversation.otherUser.name)}</AvatarFallback>
          </Avatar>
        </BorderedAvatar>
        {conversation.unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center min-w-0">
            <span className={cn("text-sm truncate", conversation.unreadCount > 0 ? "font-semibold" : "font-medium")}>
              {conversation.otherUser.name}
            </span>
            {conversation.otherUser.username && (
              <span className="text-[11px] text-muted-foreground shrink-0 ml-1.5">
                @{conversation.otherUser.username}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {conversation.otherUser.username && (
              <UserFlairs username={conversation.otherUser.username} context="inline" max={1} />
            )}
            {conversation.lastMessage && (
              <span className="text-[11px] text-muted-foreground">
                {formatRelativeTime(conversation.lastMessage.createdAt)}
              </span>
            )}
          </div>
        </div>
        <p
          className={cn(
            "text-xs truncate",
            conversation.unreadCount > 0
              ? "text-foreground font-medium"
              : "text-muted-foreground",
          )}
        >
          {lastMessagePreview}
        </p>
      </div>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationList({
  activeConversationId,
  onSelect,
}: {
  activeConversationId: string | null;
  onSelect: (conversation: ConversationPreview) => void;
}) {
  const [showCompose, setShowCompose] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await getConversations();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 30000, // Poll every 30s as fallback
  });

  const messages = data?.messages ?? [];
  const requests = data?.requests ?? [];
  const requestCount = requests.length;

  usePrefetchUserFlairs([...messages, ...requests].map((c) => c.otherUser.username));

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Messages</h2>
          <Button variant="ghost" size="icon-sm" onClick={() => setShowCompose(true)}>
            <SquarePen className="h-4 w-4" />
          </Button>
        </div>
        <ListSkeleton />
        <ComposeDialog open={showCompose} onOpenChange={setShowCompose} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <h2 className="text-lg font-semibold">Messages</h2>
        <Button variant="ghost" size="icon-sm" onClick={() => setShowCompose(true)}>
          <SquarePen className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="messages" className="flex flex-1 flex-col min-h-0">
        <TabsList variant="line" className="px-4 shrink-0">
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5">
            Requests
            {requestCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                {requestCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="flex-1 overflow-y-auto mt-0">
          {messages.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => onSelect(conv)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="flex-1 overflow-y-auto mt-0">
          {requests.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">No message requests</p>
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => onSelect(conv)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ComposeDialog open={showCompose} onOpenChange={setShowCompose} />
    </div>
  );
}
