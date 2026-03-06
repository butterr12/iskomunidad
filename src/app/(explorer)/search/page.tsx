import type { Metadata } from "next";
import { SearchView } from "@/components/search/search-view";

export const metadata: Metadata = {
  title: "Search",
  description: "Search people, posts, events, and gigs on iskomunidad.",
};

export default function SearchPage() {
  return (
    <main className="flex flex-1 flex-col min-h-0">
      <SearchView />
    </main>
  );
}
