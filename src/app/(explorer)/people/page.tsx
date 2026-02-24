import type { Metadata } from "next";
import { PeopleTab } from "@/components/people/people-tab";

export const metadata: Metadata = {
  title: "People",
  description: "Discover and follow people on iskomunidad.",
  alternates: { canonical: "/people" },
  openGraph: { url: "/people" },
};

export default function PeoplePage() {
  return (
    <main className="flex flex-1 flex-col min-h-0">
      <PeopleTab />
    </main>
  );
}
