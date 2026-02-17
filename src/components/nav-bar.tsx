"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavTab = "map" | "community" | "events" | "gigs";

const tabs: { label: string; value: NavTab; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Map", value: "map", icon: MapPin },
  { label: "Community", value: "community", icon: Users },
  { label: "Events", value: "events", icon: CalendarDays },
  { label: "Gigs", value: "gigs", icon: Hammer },
];

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

interface NavBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export function NavBar({ activeTab, onTabChange }: NavBarProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const user = session?.user;
  const displayUsername = (user as Record<string, unknown> | undefined)
    ?.displayUsername as string | undefined;

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
                key={t.value}
                variant={activeTab === t.value ? "default" : "ghost"}
                size="sm"
                onClick={() => onTabChange(t.value)}
                className="gap-1.5"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-tight">Explorer</span>
          </div>
        </div>
      </header>

      {/* Mobile: slim top bar */}
      <header className="fixed top-0 left-0 right-0 z-[1000] sm:hidden border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-12 items-center justify-between px-4">
          <button
            onClick={() => setSheetOpen(true)}
            className="rounded-full transition-shadow hover:ring-2 hover:ring-muted-foreground/30 hover:ring-offset-1 hover:ring-offset-background"
          >
            <Avatar size="sm">
              <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? "User"} />
              <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
            </Avatar>
          </button>
          <div className="flex items-center gap-1">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-tight">Explorer</span>
          </div>
        </div>
      </header>

      {/* Mobile: bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[1000] sm:hidden border-t bg-background/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-around">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => onTabChange(t.value)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors",
                activeTab === t.value
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <t.icon className={cn("h-5 w-5", activeTab === t.value && "text-primary")} />
              {t.label}
            </button>
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
