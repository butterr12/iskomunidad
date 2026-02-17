"use client";

import { useSession } from "@/lib/auth-client";
import { NavBar } from "@/components/nav-bar";

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  const { isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <NavBar />
      {children}
    </div>
  );
}
