"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { NotificationTable } from "@/components/admin/notification-table";
import { adminGetNotifications, adminMarkAllNotificationsRead } from "@/actions/admin";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    const res = await adminGetNotifications();
    if (res.success) setNotifications(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkAllRead = async () => {
    await adminMarkAllNotificationsRead();
    fetchNotifications();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <NotificationTable
      notifications={notifications as never[]}
      onMarkAllRead={handleMarkAllRead}
    />
  );
}
