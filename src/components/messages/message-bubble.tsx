"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MessageData } from "@/actions/messages";

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

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
}: {
  message: MessageData;
  isOwn: boolean;
  showAvatar: boolean;
}) {
  return (
    <div
      className={cn("flex gap-2 px-4 py-0.5", isOwn ? "flex-row-reverse" : "flex-row")}
    >
      {showAvatar ? (
        <Avatar size="sm" className="mt-1 shrink-0">
          <AvatarImage
            src={message.sender?.image ?? undefined}
            alt={message.sender?.name ?? "User"}
          />
          <AvatarFallback className="text-xs">
            {getInitials(message.sender?.name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 shrink-0" />
      )}

      <div className={cn("flex max-w-[70%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
        {message.imageUrl && (
          <img
            src={`/api/photos/${message.imageUrl}`}
            alt="Shared image"
            className="max-w-full rounded-xl object-cover"
            style={{ maxHeight: 300 }}
          />
        )}
        {message.body && (
          <div
            className={cn(
              "rounded-2xl px-3 py-2 text-sm break-words",
              isOwn
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
            )}
          >
            {message.body}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground px-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
