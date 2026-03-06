import type { Metadata } from "next";
import { EditGigPageClient } from "./client";

export const metadata: Metadata = {
  title: "Edit Gig",
  description: "Update your gig listing.",
  robots: { index: false },
};

export default function EditGigPage() {
  return <EditGigPageClient />;
}
