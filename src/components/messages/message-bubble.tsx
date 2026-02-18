"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RotateCw } from "lucide-react";
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
  status,
  onRetry,
  imagePreviewUrl,
}: {
  message: MessageData;
  isOwn: boolean;
  showAvatar: boolean;
  status?: "sending" | "failed";
  onRetry?: () => void;
  imagePreviewUrl?: string;
}) {
  const isFailed = status === "failed";
  const isSending = status === "sending";
  const imageSrc = imagePreviewUrl ?? (message.imageUrl ? `/api/photos/${message.imageUrl}` : null);

  return (
    <div
      className={cn(
        "flex gap-2 px-4 py-0.5",
        isOwn ? "flex-row-reverse" : "flex-row",
        isSending && "opacity-70",
      )}
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
        {imageSrc && (
          <img
            src={imageSrc}
            alt="Shared image"
            className={cn("max-w-full rounded-xl object-cover", isFailed && "opacity-50")}
            style={{ maxHeight: 300 }}
          />
        )}
        {message.body && (
          <div
            className={cn(
              "rounded-2xl px-3 py-2 text-sm break-words",
              isOwn
                ? isFailed
                  ? "bg-destructive/80 text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
            )}
          >
            {message.body}
          </div>
        )}
        {isFailed ? (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-[10px] text-destructive px-1 hover:underline"
          >
            <RotateCw className="h-2.5 w-2.5" />
            Failed to send · Tap to retry
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground px-1">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
