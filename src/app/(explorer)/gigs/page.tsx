import type { Metadata } from "next";
import { GigsTab } from "@/components/gigs/gigs-tab";

export const metadata: Metadata = {
  title: "Gigs",
  description: "Find side gigs and opportunities posted by the campus community.",
  alternates: { canonical: "/gigs" },
  openGraph: { url: "/gigs" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function GigsPage({ searchParams }: Props) {
  const params = await searchParams;
  const gigParam = Array.isArray(params.gig) ? params.gig[0] : params.gig;
  const initialGigId = gigParam && UUID_RE.test(gigParam) ? gigParam : null;

  return (
    <main className="flex flex-1 flex-col min-h-0">
      <GigsTab initialGigId={initialGigId} />
    </main>
  );
}
