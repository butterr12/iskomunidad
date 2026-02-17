"use client";

import { useReducer } from "react";
import { NotificationTable } from "@/components/admin/notification-table";
import { getNotifications, markAllNotificationsRead } from "@/lib/admin-store";

export default function NotificationsPage() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const notifications = getNotifications();

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    rerender();
  };

  return (
    <NotificationTable
      notifications={notifications}
      onMarkAllRead={handleMarkAllRead}
    />
  );
}
