import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GoBackButton } from "@/components/go-back-button";
import { getOptionalSession } from "@/actions/_helpers";

export default async function NotFound() {
  const session = await getOptionalSession();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/">Go to Home</Link>
        </Button>
        {session?.user ? (
          <GoBackButton />
        ) : (
          <Button asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
