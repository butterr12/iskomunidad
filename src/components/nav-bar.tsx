"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { MapPin, Users, CalendarDays, LogOut } from "lucide-react";

export type NavTab = "map" | "community" | "events";

const tabs: { label: string; value: NavTab; icon: React.ReactNode }[] = [
  { label: "Map", value: "map", icon: <MapPin className="h-4 w-4" /> },
  { label: "Community", value: "community", icon: <Users className="h-4 w-4" /> },
  { label: "Events", value: "events", icon: <CalendarDays className="h-4 w-4" /> },
];

interface NavBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export function NavBar({ activeTab, onTabChange }: NavBarProps) {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <header className="fixed top-0 left-0 right-0 z-[1000] border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-1">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold tracking-tight">Explorer</span>
        </div>

        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <Button
              key={t.value}
              variant={activeTab === t.value ? "default" : "ghost"}
              size="sm"
              onClick={() => onTabChange(t.value)}
              className="gap-1.5"
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {session?.user && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.user.name}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              router.push("/sign-in");
              router.refresh();
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
