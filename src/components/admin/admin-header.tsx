"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight } from "lucide-react";

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
  "/admin/gigs/queue": "Gigs Queue",
  "/admin/gigs": "All Gigs",
  "/admin/gigs/create": "Create Gig",
  "/admin/notifications": "Notifications",
  "/admin/settings": "Settings",
};

const createActions: Record<string, { label: string; href: string }> = {
  "/admin/posts": { label: "Create Post", href: "/admin/posts/create" },
  "/admin/events": { label: "Create Event", href: "/admin/events/create" },
  "/admin/gigs": { label: "Create Gig", href: "/admin/gigs/create" },
  "/admin/locations": { label: "Create Location", href: "/admin/locations/create" },
};

const breadcrumbs: Record<string, { parentHref: string; parentLabel: string; current: string }> = {
  "/admin/posts/create": { parentHref: "/admin/posts", parentLabel: "All Posts", current: "Create Post" },
  "/admin/events/create": { parentHref: "/admin/events", parentLabel: "All Events", current: "Create Event" },
  "/admin/gigs/create": { parentHref: "/admin/gigs", parentLabel: "All Gigs", current: "Create Gig" },
  "/admin/locations/create": { parentHref: "/admin/locations", parentLabel: "All Locations", current: "Create Location" },
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

  const createAction = createActions[pathname];
  const breadcrumb = breadcrumbs[pathname];

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-3">
        {breadcrumb ? (
          <nav className="flex items-center gap-1.5 text-lg">
            <Link
              href={breadcrumb.parentHref}
              className="font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {breadcrumb.parentLabel}
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{breadcrumb.current}</span>
          </nav>
        ) : (
          <h1 className="text-lg font-semibold">{title}</h1>
        )}
        {createAction && (
          <Button size="sm" asChild>
            <Link href={createAction.href}>
              <Plus className="mr-1 h-4 w-4" />
              {createAction.label}
            </Link>
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
