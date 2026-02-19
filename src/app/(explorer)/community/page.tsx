import type { Metadata } from "next";
import { CommunityTab } from "@/components/community/community-tab";

export const metadata: Metadata = {
  title: "Community",
  description: "Read and share campus discussions, questions, and announcements.",
  alternates: { canonical: "/community" },
  openGraph: { url: "/community" },
};

export default function CommunityPage() {
  return (
    <main className="flex flex-1 flex-col min-h-0">
      <CommunityTab />
    </main>
  );
}
