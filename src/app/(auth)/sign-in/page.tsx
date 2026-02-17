import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";

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

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: RouteSearchParams;
}) {
  const resolvedSearchParams = await getSearchParams(searchParams);
  const rawMessage = resolvedSearchParams.message;
  const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;

  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-lg border p-6 text-center text-sm text-muted-foreground">
          Loading sign in form...
        </div>
      }
    >
      <SignInForm message={message} />
    </Suspense>
  );
}
