"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <main className="flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome{session?.user?.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="text-muted-foreground">
            You are signed in as{" "}
            <span className="font-medium text-foreground">
              {session?.user?.email}
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </main>
    </div>
  );
}
