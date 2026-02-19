import type { Metadata } from "next";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/auth-schema";
import ProfilePageClient from "./profile-page-client";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;

  const profile = await db
    .select({
      name: user.name,
      username: user.username,
      displayUsername: user.displayUsername,
    })
    .from(user)
    .where(and(eq(user.username, username), eq(user.status, "active")))
    .limit(1)
    .then((rows) => rows[0]);

  if (!profile) {
    return { title: "Profile Not Found" };
  }

  const displayName = profile.name;

  return {
    title: displayName,
    openGraph: {
      type: "profile",
      url: `/profile/${profile.username}`,
    },
    alternates: {
      canonical: `/profile/${profile.username}`,
    },
  };
}

export default function ProfilePage() {
  return <ProfilePageClient />;
}
