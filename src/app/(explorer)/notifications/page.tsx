import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = {
  title: "Notifications | iskomunidad",
  description: "View updates about your posts, events, gigs, and activity.",
};

export default function NotificationsPage() {
  return (
    <main className="flex flex-1 flex-col min-h-0 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
      <NotificationList />
    </main>
  );
}
