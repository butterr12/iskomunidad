"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useRouter } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  ClipboardList,
  FileText,
  Bell,
  Settings,
  LogOut,
  Calendar,
  MapPin,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/admin", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
    ],
  },
  {
    label: "Posts",
    items: [
      { href: "/admin/queue", label: "Post Queue", shortLabel: "Queue", icon: ClipboardList },
      { href: "/admin/posts", label: "All Posts", shortLabel: "Posts", icon: FileText },
    ],
  },
  {
    label: "Events",
    items: [
      { href: "/admin/events/queue", label: "Events Queue", shortLabel: "Queue", icon: ClipboardList },
      { href: "/admin/events", label: "All Events", shortLabel: "Events", icon: Calendar },
    ],
  },
  {
    label: "Locations",
    items: [
      { href: "/admin/locations/queue", label: "Locations Queue", shortLabel: "Queue", icon: ClipboardList },
      { href: "/admin/locations", label: "All Locations", shortLabel: "Locations", icon: MapPin },
    ],
  },
  {
    label: "Gigs",
    items: [
      { href: "/admin/gigs/queue", label: "Gigs Queue", shortLabel: "Queue", icon: ClipboardList },
      { href: "/admin/gigs", label: "All Gigs", shortLabel: "Gigs", icon: Briefcase },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/notifications", label: "Notifications", shortLabel: "Notifs", icon: Bell },
      { href: "/admin/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAdminAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full w-60 flex-col border-r bg-muted/30">
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
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-background">
        <div className="flex w-full overflow-x-auto">
          {allItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[4.5rem] flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors",
                isActive(item.href)
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.shortLabel}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex min-w-[4.5rem] flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium text-muted-foreground transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
