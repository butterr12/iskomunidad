import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "iskomunidad",
  description:
    "Discover campus landmarks, events, community posts, and gigs in one place.",
};

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/map");
  }

  return <LandingPage />;
}
