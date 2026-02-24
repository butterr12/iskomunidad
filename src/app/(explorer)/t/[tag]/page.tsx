import type { Metadata } from "next";
import { TagDiscoveryPage } from "@/components/tags/tag-discovery-page";

interface Props {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `#${decodeURIComponent(tag)}`,
    description: `Posts, gigs, and events tagged #${decodeURIComponent(tag)}`,
  };
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  return (
    <main className="flex flex-1 flex-col min-h-0">
      <TagDiscoveryPage tag={decodeURIComponent(tag)} />
    </main>
  );
}
