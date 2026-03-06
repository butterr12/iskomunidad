import type { Metadata } from "next";
import { CreateGigPageClient } from "./client";

export const metadata: Metadata = {
  title: "Post a Gig",
  description: "Find help from the campus community.",
  robots: { index: false },
};

export default function CreateGigPage() {
  return <CreateGigPageClient />;
}
