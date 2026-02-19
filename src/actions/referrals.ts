"use server";

import { db } from "@/lib/db";
import { user as userTable } from "@/lib/schema";
import { eq, count } from "drizzle-orm";
import { getSession, type ActionResult } from "./_helpers";
import { siteConfig } from "@/lib/site-config";
import { buildReferralLink } from "@/lib/referrals";

export async function getMyReferralSummary(): Promise<
  ActionResult<{ referralLink: string; invitedCount: number }>
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const username = session.user.username;
  if (!username) {
    return { success: false, error: "Set a username first to get your referral link" };
  }

  const [row] = await db
    .select({ count: count() })
    .from(userTable)
    .where(eq(userTable.inviterId, session.user.id));

  return {
    success: true,
    data: {
      referralLink: buildReferralLink(siteConfig.url, username),
      invitedCount: row?.count ?? 0,
    },
  };
}
