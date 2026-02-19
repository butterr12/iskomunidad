import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = {
  title: "Notifications",
  description: "View updates about your posts, events, gigs, and activity.",
  alternates: { canonical: "/notifications" },
  openGraph: { url: "/notifications" },
  robots: { index: false },
};

export default function NotificationsPage() {
  return (
    <main className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 max-w-2xl mx-auto w-full">
          <NotificationList />
        </div>
      </div>
    </main>
  );
}
