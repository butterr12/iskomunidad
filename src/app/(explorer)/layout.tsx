"use client";

import { useSession } from "@/lib/auth-client";
import { NavBar } from "@/components/nav-bar";
import { Skeleton } from "@/components/ui/skeleton";

function ExplorerSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar skeleton */}
      <div className="border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="hidden sm:flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <Skeleton className="h-6 w-28 rounded-md" />
        </div>
      </div>

      {/* Content area skeleton */}
      <div className="flex-1 p-4 space-y-3">
        <Skeleton className="h-10 w-48 rounded-md" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>

      {/* Bottom bar skeleton (mobile) */}
      <div className="sm:hidden border-t bg-background/95">
        <div className="flex h-14 items-center justify-around">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  const { isPending } = useSession();

  if (isPending) {
    return <ExplorerSkeleton />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <NavBar />
      {children}
    </div>
  );
}
