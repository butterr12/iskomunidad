import { NotificationList } from "@/components/notifications/notification-list";

export default function NotificationsPage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-4 max-w-2xl mx-auto w-full">
      <NotificationList />
    </main>
  );
}
