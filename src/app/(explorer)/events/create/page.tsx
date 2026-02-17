import type { Metadata } from "next";
import { EventFormWizard } from "@/components/events/event-form-wizard";

export const metadata: Metadata = {
  title: "Create Event | iskomunidad",
  description: "Create and publish a new campus event.",
};

export default function CreateEventPage() {
  return <EventFormWizard mode="create" />;
}
