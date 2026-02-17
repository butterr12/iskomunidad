"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  Shield,
  LayoutDashboard,
  ClipboardList,
  FileText,
  PlusCircle,
  Bell,
  Settings,
  LogOut,
  Calendar,
  CalendarPlus,
  MapPin,
  MapPinPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const navGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Posts",
    items: [
      { href: "/admin/queue", label: "Post Queue", icon: ClipboardList },
      { href: "/admin/posts", label: "All Posts", icon: FileText },
      { href: "/admin/posts/create", label: "Create Post", icon: PlusCircle },
    ],
  },
  {
    label: "Events",
    items: [
      { href: "/admin/events/queue", label: "Events Queue", icon: ClipboardList },
      { href: "/admin/events", label: "All Events", icon: Calendar },
      { href: "/admin/events/create", label: "Create Event", icon: CalendarPlus },
    ],
  },
  {
    label: "Locations",
    items: [
      { href: "/admin/locations/queue", label: "Locations Queue", icon: ClipboardList },
      { href: "/admin/locations", label: "All Locations", icon: MapPin },
      { href: "/admin/locations/create", label: "Create Location", icon: MapPinPlus },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAdminAuth();

  const isActive = (href: string) => pathname === href;

  return (
    <div className="flex h-full w-60 flex-col border-r bg-muted/30">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-semibold">Admin Panel</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <Separator className="my-2" />}
            {group.label && (
              <p className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
