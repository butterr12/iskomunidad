"use client";

import { useRouter } from "next/navigation";
import { useSocket } from "@/components/providers/socket-provider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function MessageNotificationBanner() {
  const router = useRouter();
  const { messageNotification, dismissNotification } = useSocket();

  if (!messageNotification) return null;

  return (
    <button
      onClick={() => {
        dismissNotification();
        router.push(`/messages?chat=${messageNotification.conversationId}`);
      }}
      className="fixed left-1/2 top-14 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 fade-in duration-300"
    >
      <Avatar className="shrink-0">
        <AvatarImage
          src={messageNotification.senderImage ?? undefined}
          alt={messageNotification.senderName}
        />
        <AvatarFallback>
          {messageNotification.senderName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold">
          {messageNotification.senderName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {messageNotification.messagePreview}
        </p>
      </div>
    </button>
  );
}
