"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSession } from "@/lib/auth-client";
import { NavBar } from "@/components/nav-bar";
import { landmarks } from "@/lib/landmarks";
import type { LandmarkCategory } from "@/lib/landmarks";

const LandmarkMap = dynamic(
  () => import("@/components/landmark-map").then((mod) => mod.LandmarkMap),
  { ssr: false }
);

export default function Home() {
  const { isPending } = useSession();
  const [filter, setFilter] = useState<LandmarkCategory | "all">("all");

  const filtered = useMemo(
    () => (filter === "all" ? landmarks : landmarks.filter((l) => l.category === filter)),
    [filter]
  );

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <NavBar activeFilter={filter} onFilterChange={setFilter} />
      <main className="flex-1 pt-14">
        <LandmarkMap landmarks={filtered} />
      </main>
    </div>
  );
}
