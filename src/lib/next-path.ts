const INTERNAL_BASE = "http://localhost";

/**
 * Only allow internal, root-relative redirects to prevent open redirects.
 */
export function sanitizeNextPath(
  nextPath: string | null | undefined,
): string | null {
  if (!nextPath) return null;

  const trimmed = nextPath.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\")) return null;

  try {
    const parsed = new URL(trimmed, INTERNAL_BASE);
    if (parsed.origin !== INTERNAL_BASE) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
