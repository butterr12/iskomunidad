import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { MapPageClient } from "@/components/map-page-client";

export const metadata: Metadata = {
  title: "Map",
  description: "Explore campus landmarks and see related events and community posts.",
  alternates: { canonical: "/map" },
  openGraph: { url: "/map" },
};

function MapPageFallback() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  );
}

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

export default async function MapPage({
  searchParams,
}: {
  searchParams?: RouteSearchParams;
}) {
  const resolvedSearchParams = await getSearchParams(searchParams);
  const rawLandmark = resolvedSearchParams.landmark;
  const landmarkParam = Array.isArray(rawLandmark)
    ? rawLandmark[0]
    : rawLandmark;

  return (
    <Suspense fallback={<MapPageFallback />}>
      <MapPageClient landmarkParam={landmarkParam} />
    </Suspense>
  );
}
