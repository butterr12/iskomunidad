import type { Metadata } from "next";
import { GigsTab } from "@/components/gigs/gigs-tab";

export const metadata: Metadata = {
  title: "Gigs",
  description: "Find side gigs and opportunities posted by the campus community.",
  alternates: { canonical: "/gigs" },
  openGraph: { url: "/gigs" },
};

export default function GigsPage() {
  return (
    <main className="flex flex-1 flex-col min-h-0">
      <GigsTab />
    </main>
  );
}
