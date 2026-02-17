import type { Metadata } from "next";
import { CreateEventPageClient } from "./client";

export const metadata: Metadata = {
  title: "Create Event | iskomunidad",
  description: "Create and publish a new campus event.",
};

export default function CreateEventPage() {
  return <CreateEventPageClient />;
}
