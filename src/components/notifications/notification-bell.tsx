"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getUnreadNotificationCount } from "@/actions/notifications";

export function NotificationBell() {
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ["unreadNotificationCount"],
    queryFn: async () => {
      const res = await getUnreadNotificationCount();
      if (!res.success) return 0;
      return res.data.count;
    },
    refetchInterval: 30_000,
  });

  const count = data ?? 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8"
      onClick={() => router.push("/notifications")}
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none"
        >
          {count > 99 ? "99+" : count}
        </Badge>
      )}
      <span className="sr-only">Notifications</span>
    </Button>
  );
}
