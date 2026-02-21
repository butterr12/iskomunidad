import type { MetadataRoute } from "next";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/auth-schema";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteConfig.url}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteConfig.url}/map`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteConfig.url}/c`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteConfig.url}/events`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteConfig.url}/gigs`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteConfig.url}/sign-in`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteConfig.url}/sign-up`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteConfig.url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteConfig.url}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const users = await db
    .select({ username: user.username })
    .from(user)
    .where(and(eq(user.status, "active"), isNotNull(user.username)));

  const profileRoutes: MetadataRoute.Sitemap = users
    .filter((u) => u.username)
    .map((u) => ({
      url: `${siteConfig.url}/profile/${u.username}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));

  return [...staticRoutes, ...profileRoutes];
}
