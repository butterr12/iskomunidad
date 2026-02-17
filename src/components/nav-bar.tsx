"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { MapPin, Users, CalendarDays, LogOut } from "lucide-react";
import type { LandmarkCategory } from "@/lib/landmarks";

const filters: { label: string; value: LandmarkCategory | "all"; icon: React.ReactNode }[] = [
  { label: "All", value: "all", icon: <MapPin className="h-4 w-4" /> },
  { label: "Attractions", value: "attraction", icon: <MapPin className="h-4 w-4" /> },
  { label: "Community", value: "community", icon: <Users className="h-4 w-4" /> },
  { label: "Events", value: "event", icon: <CalendarDays className="h-4 w-4" /> },
];

interface NavBarProps {
  activeFilter: LandmarkCategory | "all";
  onFilterChange: (filter: LandmarkCategory | "all") => void;
}

export function NavBar({ activeFilter, onFilterChange }: NavBarProps) {
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
          {filters.map((f) => (
            <Button
              key={f.value}
              variant={activeFilter === f.value ? "default" : "ghost"}
              size="sm"
              onClick={() => onFilterChange(f.value)}
              className="gap-1.5"
            >
              {f.icon}
              <span className="hidden sm:inline">{f.label}</span>
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
