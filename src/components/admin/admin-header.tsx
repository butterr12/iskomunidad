"use client";

import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/queue": "Moderation Queue",
  "/admin/posts": "All Posts",
  "/admin/posts/create": "Create Post",
  "/admin/events/queue": "Events Queue",
  "/admin/events": "All Events",
  "/admin/events/create": "Create Event",
  "/admin/locations/queue": "Locations Queue",
  "/admin/locations": "All Locations",
  "/admin/locations/create": "Create Location",
  "/admin/notifications": "Notifications",
  "/admin/settings": "Settings",
};

export function AdminHeader() {
  const pathname = usePathname();
  const { user } = useAdminAuth();
  const title = pageTitles[pathname] ?? "Admin";
  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "AD";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
