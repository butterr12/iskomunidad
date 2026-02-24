import { z } from "zod";

/** Canonical tag format: lowercase, no leading #, hyphens for spaces, trimmed */
export function cleanTag(input: string): string {
  return input
    .replace(/^#+/, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 50;

export const tagsSchema = z
  .array(z.string().max(MAX_TAG_LENGTH).transform(cleanTag))
  .max(MAX_TAGS)
  .default([]);
