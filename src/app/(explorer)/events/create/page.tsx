import type { Metadata } from "next";
import { CreateEventPageClient } from "./client";

export const metadata: Metadata = {
  title: "Create Event",
  description: "Create and publish a new campus event.",
  robots: { index: false },
};

export default function CreateEventPage() {
  return <CreateEventPageClient />;
}
