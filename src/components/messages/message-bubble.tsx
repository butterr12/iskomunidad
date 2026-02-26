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

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  seen,
  status,
  onRetry,
  imagePreviewUrl,
}: {
  message: MessageData;
  isOwn: boolean;
  showAvatar: boolean;
  seen?: boolean;
  status?: "sending" | "failed";
  onRetry?: () => void;
  imagePreviewUrl?: string;
}) {
  const isFailed = status === "failed";
  const isSending = status === "sending";
  const imageSrc = imagePreviewUrl ?? (message.imageUrl ? `/api/photos/${message.imageUrl}` : null);

  return (
    <div className={cn("px-4 py-0.5", isSending && "opacity-70")}>
      <div
        className={cn(
          "flex items-end gap-2",
          isOwn ? "flex-row-reverse" : "flex-row",
        )}
      >
        {showAvatar ? (
          <Avatar size="sm" className="shrink-0 mb-px">
            <AvatarImage
              src={message.sender?.image ?? undefined}
              alt={message.sender?.name ?? "User"}
            />
            <AvatarFallback className="text-xs">
              {getInitials(message.sender?.name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-6 shrink-0" />
        )}

        {imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- chat image with dynamic max-width/height sizing
          <img
            src={imageSrc}
            alt="Shared image"
            className={cn("max-w-[70%] rounded-xl object-cover", isFailed && "opacity-50")}
            style={{ maxHeight: 300 }}
          />
        )}
        {message.body && (
          <div
            className={cn(
              "max-w-[70%] rounded-2xl px-3 py-2 text-sm break-words",
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
      </div>

      {/* Retry button always visible for failed messages */}
      {isFailed && (
        <div className={cn("mt-0.5", isOwn ? "text-right mr-8" : "ml-8")}>
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-[10px] text-destructive px-1 hover:underline"
          >
            <RotateCw className="h-2.5 w-2.5" />
            Failed to send · Tap to retry
          </button>
        </div>
      )}

      {/* Read receipt */}
      {seen && (
        <div className="mt-0.5 text-right">
          <span className="text-[10px] text-muted-foreground">Seen</span>
        </div>
      )}
    </div>
  );
}
