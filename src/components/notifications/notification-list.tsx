"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/actions/notifications";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  contentType: string;
  targetId: string;
  targetTitle: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  gig: "Gig",
  event: "Event",
  landmark: "Landmark",
};

function getTypeBadge(type: string): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (type.endsWith("_approved")) {
    return { label: "Approved", variant: "default" };
  }
  if (type.endsWith("_rejected")) {
    return { label: "Rejected", variant: "destructive" };
  }
  if (type.endsWith("_pending")) {
    return { label: "Pending", variant: "secondary" };
  }
  switch (type) {
    case "post_commented":
      return { label: "Comment", variant: "secondary" };
    case "comment_replied":
      return { label: "Reply", variant: "secondary" };
    case "post_mentioned":
    case "comment_mentioned":
      return { label: "Mention", variant: "secondary" };
    case "post_upvoted":
    case "comment_upvoted":
      return { label: "Upvote", variant: "outline" };
    default:
      return { label: "Activity", variant: "outline" };
  }
}

function NotificationSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

function getNotificationHref(n: Notification): string {
  if (n.contentType === "post") {
    if (n.type === "post_pending") return `/c`;
    if (n.type === "post_rejected") return `/community`;
    return `/c/${n.targetId}`;
  }
  switch (n.contentType) {
    case "gig":
      return `/gigs?gig=${n.targetId}`;
    case "event":
      return `/events?event=${n.targetId}`;
    case "landmark":
      return `/map?landmark=${n.targetId}`;
    default:
      return `/community`;
  }
}

export function NotificationList() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["userNotifications"],
    queryFn: async () => {
      const res = await getUserNotifications();
      if (!res.success) return [];
      return res.data as Notification[];
    },
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["userNotifications"] });
      const prev = queryClient.getQueryData<Notification[]>(["userNotifications"]);
      queryClient.setQueryData<Notification[]>(["userNotifications"], (old) =>
        old?.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      queryClient.setQueryData<number>(["unreadNotificationCount"], (old) =>
        old != null && old > 0 ? old - 1 : 0,
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["userNotifications"], ctx.prev);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["userNotifications"] });
      const prev = queryClient.getQueryData<Notification[]>(["userNotifications"]);
      queryClient.setQueryData<Notification[]>(["userNotifications"], (old) =>
        old?.map((n) => ({ ...n, isRead: true })),
      );
      queryClient.setQueryData<number>(["unreadNotificationCount"], 0);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["userNotifications"], ctx.prev);
    },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Notifications</h1>
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <NotificationSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="default" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {notifications && notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((n) => {
            const typeBadge = getTypeBadge(n.type);
            return (
              <button
                key={n.id}
                className={cn(
                  "w-full text-left rounded-xl border bg-card p-4 transition-colors",
                  !n.isRead && "border-primary/40 bg-primary/5",
                  n.isRead && "hover:bg-muted/50",
                )}
                onClick={() => {
                  if (!n.isRead) markReadMutation.mutate(n.id);
                  router.push(getNotificationHref(n));
                }}
              >
                <div className="flex items-start gap-3">
                  {!n.isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={typeBadge.variant} className="text-[10px]">
                        {typeBadge.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {CONTENT_TYPE_LABELS[n.contentType] ?? n.contentType}
                      </Badge>
                    </div>
                    <p className="text-sm whitespace-pre-line">{n.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      )}
    </div>
  );
}
