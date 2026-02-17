"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { NotificationTable } from "@/components/admin/notification-table";
import {
  adminGetNotifications,
  adminMarkAllNotificationsRead,
} from "@/actions/admin";

type AdminNotification = Parameters<
  typeof NotificationTable
>[0]["notifications"][number];

const NOTIFICATIONS_QUERY_KEY = ["admin-notifications"] as const;

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async () => {
      const res = await adminGetNotifications();
      return res.success ? (res.data as AdminNotification[]) : [];
    },
  });

  const handleMarkAllRead = async () => {
    await adminMarkAllNotificationsRead();
    await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <NotificationTable
      notifications={notifications}
      onMarkAllRead={handleMarkAllRead}
    />
  );
}
