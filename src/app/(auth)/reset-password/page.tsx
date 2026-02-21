import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { sanitizeNextPath } from "@/lib/next-path";

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

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: RouteSearchParams;
}) {
  const resolvedSearchParams = await getSearchParams(searchParams);
  const rawToken = resolvedSearchParams.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const rawNext = resolvedSearchParams.next;
  const nextPath = sanitizeNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-lg border p-6 text-center text-sm text-muted-foreground">
          Loading reset form...
        </div>
      }
    >
      <ResetPasswordForm token={token} nextPath={nextPath} />
    </Suspense>
  );
}
