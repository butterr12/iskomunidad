import type { Metadata } from "next";
import { CommunityTab } from "@/components/community/community-tab";

export const metadata: Metadata = {
  title: "Community | iskomunidad",
  description: "Read and share campus discussions, questions, and announcements.",
};

export default function CommunityPage() {
  return (
    <main className="flex flex-1 flex-col">
      <CommunityTab />
    </main>
  );
}
