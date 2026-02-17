import { Suspense } from "react";
import { VerifyEmailContent } from "@/components/auth/verify-email-content";

type RouteSearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

async function getSearchParams(
  searchParams: RouteSearchParams,
): Promise<Record<string, string | string[] | undefined>> {
  if (!searchParams) return {};
  if (typeof (searchParams as Promise<unknown>).then === "function") {
    return (await searchParams) as Record<string, string | string[] | undefined>;
  }
  return searchParams;
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: RouteSearchParams;
}) {
  const resolvedSearchParams = await getSearchParams(searchParams);
  const rawEmail = resolvedSearchParams.email;
  const email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;

  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-lg border p-6 text-center text-sm text-muted-foreground">
          Loading verification info...
        </div>
      }
    >
      <VerifyEmailContent email={email} />
    </Suspense>
  );
}
