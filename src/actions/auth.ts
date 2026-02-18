"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userLegalConsent } from "@/lib/schema";
import { LEGAL_VERSIONS } from "@/lib/legal";
import type { ActionResult } from "./_helpers";
import { getClientIp } from "./_helpers";

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

    return { success: true, data: undefined };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create account";
    return { success: false, error: message };
  }
}
