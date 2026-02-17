import type { Metadata } from "next";
import { EditEventPageClient } from "@/components/events/edit-event-page-client";

export const metadata: Metadata = {
  title: "Edit Event | iskomunidad",
  description: "Update event details before publishing changes.",
};

export default function EditEventPage() {
  return <EditEventPageClient />;
}
