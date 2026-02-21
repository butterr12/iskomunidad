import { z } from "zod";

/**
 * Returns true only for http: / https: URLs.
 * Used as a rendering guard to prevent unsafe schemes (javascript:, data:, etc.)
 * from being rendered as clickable links.
 */
export function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Trims whitespace, prepends https:// if no scheme present,
 * validates with isSafeUrl, returns normalized URL or null.
 */
export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  return isSafeUrl(withScheme) ? withScheme : null;
}

/**
 * Zod schema for link URLs on community posts.
 * Normalizes bare domains (e.g. "example.com" -> "https://example.com")
 * and rejects unsafe schemes (javascript:, data:, etc.).
 *
 * Uses z.preprocess to preserve key optionality in the inferred input type.
 */
export const safeLinkUrl = z.preprocess(
  (val) => {
    if (typeof val !== "string" || !val.trim()) return undefined;
    return normalizeUrl(val) ?? val;
  },
  z
    .string()
    .refine((val) => isSafeUrl(val), {
      message: "Invalid URL — only http and https links are allowed",
    })
    .optional(),
);
