"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable, userLegalConsent, userFlair } from "@/lib/schema";
import { LEGAL_VERSIONS } from "@/lib/legal";
import type { ActionResult } from "./_helpers";
import { getClientIp, getSession, guardAction } from "./_helpers";
import { getCampusFlairId } from "@/lib/user-flairs";
import { UP_CAMPUSES } from "@/lib/constants";
import { REFERRAL_COOKIE_NAME, normalizeRef } from "@/lib/referrals";

const createAccountSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  agreedToTerms: z.literal(true),
  agreedToPrivacy: z.literal(true),
  ageAttested: z.literal(true),
  guardianConsentAttested: z.literal(true),
});

export async function createAccountWithConsent(
  input: z.infer<typeof createAccountSchema>,
): Promise<ActionResult<void>> {
  const limited = await guardAction("auth.signup", { email: input.email });
  if (limited) return limited;

  try {
    const parsed = createAccountSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const hdrs = await headers();
    const ipAddress = await getClientIp(hdrs);
    const userAgent = hdrs.get("user-agent");
    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    // 1. Record consent BEFORE creating the account (consent-first).
    //    If this fails, signup is blocked — no orphaned account possible.
    let consentId: string;
    try {
      const [row] = await db
        .insert(userLegalConsent)
        .values({
          userId: null,
          email: normalizedEmail,
          consentType: "signup",
          termsVersion: LEGAL_VERSIONS.terms,
          privacyVersion: LEGAL_VERSIONS.privacy,
          legalNoticeVersion: LEGAL_VERSIONS.signupNotice,
          agreedToTerms: parsed.data.agreedToTerms,
          agreedToPrivacy: parsed.data.agreedToPrivacy,
          ageAttested: parsed.data.ageAttested,
          guardianConsentAttested: parsed.data.guardianConsentAttested,
          ipAddress,
          userAgent,
        })
        .returning({ id: userLegalConsent.id });
      consentId = row.id;
    } catch {
      return {
        success: false,
        error: "Failed to record consent. Please try again.",
      };
    }

    // 2. Create the account via Better Auth.
    //    Consent is already persisted — the worst-case failure mode is a
    //    consent row without a user (safe from a compliance standpoint).
    const result = await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        username: parsed.data.username,
        email: normalizedEmail,
        password: parsed.data.password,
      },
      headers: hdrs,
    });

    if (!result?.user?.id) {
      await db
        .delete(userLegalConsent)
        .where(eq(userLegalConsent.id, consentId));
      return { success: false, error: "Signup failed" };
    }

    // 3. Link consent to the newly created user.
    //    If this fails, consent is still recorded by email — compliance intact.
    try {
      await db
        .update(userLegalConsent)
        .set({ userId: result.user.id })
        .where(eq(userLegalConsent.id, consentId));
    } catch {
      // Non-fatal: consent exists by email, userId link is supplementary
    }

    // 4. Resolve referral inviter from cookie (non-blocking).
    try {
      const cookieStore = await cookies();
      const refCookieValue = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;
      if (refCookieValue) {
        const normalizedRef = normalizeRef(refCookieValue);
        if (normalizedRef) {
          const inviter = await db.query.user.findFirst({
            where: and(
              eq(userTable.username, normalizedRef),
              eq(userTable.status, "active"),
            ),
            columns: { id: true },
          });
          if (inviter && inviter.id !== result.user.id) {
            await db
              .update(userTable)
              .set({ inviterId: inviter.id })
              .where(and(eq(userTable.id, result.user.id), isNull(userTable.inviterId)));
          }
        }
        cookieStore.delete(REFERRAL_COOKIE_NAME);
      }
    } catch {
      // Attribution failure must not block signup
    }

    return { success: true, data: undefined };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create account";
    return { success: false, error: message };
  }
}

export async function checkConsentStatus(): Promise<
  ActionResult<{ hasValidConsent: boolean }>
> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const row = await db.query.userLegalConsent.findFirst({
    where: and(
      eq(userLegalConsent.userId, session.user.id),
      eq(userLegalConsent.termsVersion, LEGAL_VERSIONS.terms),
      eq(userLegalConsent.privacyVersion, LEGAL_VERSIONS.privacy),
      eq(userLegalConsent.agreedToTerms, true),
      eq(userLegalConsent.agreedToPrivacy, true),
      eq(userLegalConsent.ageAttested, true),
      eq(userLegalConsent.guardianConsentAttested, true),
    ),
  });

  return { success: true, data: { hasValidConsent: !!row } };
}

const recordConsentSchema = z.object({
  agreedToTerms: z.literal(true),
  agreedToPrivacy: z.literal(true),
  ageAttested: z.literal(true),
  guardianConsentAttested: z.literal(true),
});

export async function recordConsent(
  input: z.infer<typeof recordConsentSchema>,
): Promise<ActionResult<void>> {
  const parsed = recordConsentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const hdrs = await headers();
  const ipAddress = await getClientIp(hdrs);
  const userAgent = hdrs.get("user-agent");

  await db.insert(userLegalConsent).values({
    userId: session.user.id,
    email: session.user.email,
    consentType: "in-app-gate",
    termsVersion: LEGAL_VERSIONS.terms,
    privacyVersion: LEGAL_VERSIONS.privacy,
    legalNoticeVersion: LEGAL_VERSIONS.signupNotice,
    agreedToTerms: parsed.data.agreedToTerms,
    agreedToPrivacy: parsed.data.agreedToPrivacy,
    ageAttested: parsed.data.ageAttested,
    guardianConsentAttested: parsed.data.guardianConsentAttested,
    ipAddress,
    userAgent,
  });

  return { success: true, data: undefined };
}

// ─── UP University Selection ─────────────────────────────────────────────────

const validCampusValues = UP_CAMPUSES.map((c) => c.value) as readonly string[];

export async function setUserUniversity(
  university: string,
): Promise<ActionResult<void>> {
  if (!validCampusValues.includes(university)) {
    return { success: false, error: "Invalid university selection" };
  }

  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  // One-time only — reject if already set
  const existing = await db.query.user.findFirst({
    where: eq(userTable.id, session.user.id),
    columns: { university: true },
  });
  if (existing?.university) {
    return { success: false, error: "University is already set" };
  }

  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(userTable)
        .set({ university })
        .where(and(eq(userTable.id, session.user.id), isNull(userTable.university)))
        .returning({ id: userTable.id });

      if (updated.length === 0) {
        throw new Error("ALREADY_SET");
      }

      const campusFlairId = getCampusFlairId(university);
      if (campusFlairId) {
        await tx
          .insert(userFlair)
          .values({
            userId: session.user.id,
            flairId: campusFlairId,
            source: "university-sync",
            visible: true,
          })
          .onConflictDoNothing();
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_SET") {
      return { success: false, error: "University is already set" };
    }
    return { success: false, error: "Failed to set university. Please try again." };
  }

  return { success: true, data: undefined };
}
