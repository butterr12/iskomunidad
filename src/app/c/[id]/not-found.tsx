import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PostNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">This post is unavailable</h1>
      <p className="text-sm text-muted-foreground">
        It may have been removed or is no longer available for public viewing.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/">Go to Home</Link>
        </Button>
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
