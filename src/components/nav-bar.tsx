"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import {
  MapPin,
  Users,
  CalendarDays,
  Hammer,
  Settings,
  LogOut,
  Shield,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";

const tabs = [
  { label: "Map", href: "/map", icon: MapPin },
  { label: "Community", href: "/community", icon: Users },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Gigs", href: "/gigs", icon: Hammer },
] as const;

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function NavBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  const user = session?.user;
  const displayUsername = (user as Record<string, unknown> | undefined)
    ?.displayUsername as string | undefined;

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <>
      {/* Desktop: full top bar */}
      <header className="fixed top-0 left-0 right-0 z-[1000] hidden sm:block border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => setSheetOpen(true)}
            className="rounded-full transition-shadow hover:ring-2 hover:ring-muted-foreground/30 hover:ring-offset-2 hover:ring-offset-background"
          >
            <Avatar size="default">
              <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? "User"} />
              <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
            </Avatar>
          </button>

          <nav className="flex items-center gap-1">
            {tabs.map((t) => (
              <Button
                key={t.href}
                variant={pathname === t.href ? "default" : "ghost"}
                size="sm"
                className="gap-1.5"
                asChild
              >
                <Link href={t.href}>
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </Link>
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-1" dir="ltr">
            {user && <NotificationBell />}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
              <Sun className="hidden h-4 w-4 dark:block" />
              <Moon className="h-4 w-4 dark:hidden" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <span className="text-xl font-bold tracking-tight font-[family-name:var(--font-hoover)]" style={{ color: "#bf0000" }}>
              iskomunidad
            </span>
          </div>
        </div>
      </header>

      {/* Mobile: slim top bar */}
      <header className="fixed top-0 left-0 right-0 z-[1000] sm:hidden border-b bg-background/80 backdrop-blur-sm">
        <div className="relative flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSheetOpen(true)}
              className="rounded-full transition-shadow hover:ring-2 hover:ring-muted-foreground/30 hover:ring-offset-1 hover:ring-offset-background"
            >
              <Avatar size="sm">
                <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? "User"} />
                <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
              <Sun className="hidden h-4 w-4 dark:block" />
              <Moon className="h-4 w-4 dark:hidden" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 text-xl font-bold tracking-tight font-[family-name:var(--font-hoover)]" style={{ color: "#bf0000" }}>
            iskomunidad
          </span>
          <div className="flex items-center">
            {user && <NotificationBell />}
          </div>
        </div>
      </header>

      {/* Mobile: bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[1000] sm:hidden border-t bg-background/95 backdrop-blur-sm safe-bottom">
        <div className="flex h-14 items-center justify-around">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors",
                pathname === t.href
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <t.icon className={cn("h-5 w-5", pathname === t.href && "text-primary")} />
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Profile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-72 sm:w-80">
          <SheetHeader>
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Profile and navigation
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4 pb-6">
            {/* Profile preview */}
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? "User"} />
                <AvatarFallback className="text-lg">{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold truncate">{user?.name ?? "User"}</p>
                {displayUsername && (
                  <p className="text-sm text-muted-foreground truncate">
                    @{displayUsername}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Menu items */}
            {user?.role === "admin" && (
              <SheetClose asChild>
                <button
                  onClick={() => router.push("/admin")}
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Admin Panel
                </button>
              </SheetClose>
            )}

            <SheetClose asChild>
              <button
                onClick={() => router.push("/settings")}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </button>
            </SheetClose>

            <Separator />

            <button
              onClick={async () => {
                setSheetOpen(false);
                await signOut();
                router.push("/sign-in");
                router.refresh();
              }}
              className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
