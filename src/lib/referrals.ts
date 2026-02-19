export const REFERRAL_QUERY_PARAM = "ref";
export const REFERRAL_COOKIE_NAME = "ik_ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** Normalize a ref param for DB lookup (trim, lowercase, length cap). */
export function normalizeRef(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().slice(0, 30);
  return trimmed.length >= 1 ? trimmed : null;
}

/** Build a shareable referral link. */
export function buildReferralLink(baseUrl: string, username: string): string {
  return `${baseUrl}/sign-up?${REFERRAL_QUERY_PARAM}=${encodeURIComponent(username)}`;
}
