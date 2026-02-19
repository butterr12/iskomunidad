import { z } from "zod";

/**
 * Strict ISO 8601 UTC date string validator.
 *
 * Requires exact format: `YYYY-MM-DDTHH:mm:ss.sssZ`
 * Rejects:
 *  - Loose date strings ("2025", "Sat Feb 19 2025")
 *  - Invalid calendar dates that would roll over ("2025-02-30...")
 *  - Non-UTC offsets ("...+05:00")
 */
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const isoDateString = z.string().refine(
  (val) => {
    if (!ISO_UTC_RE.test(val)) return false;
    const d = new Date(val);
    if (isNaN(d.getTime())) return false;
    return d.toISOString() === val;
  },
  { message: "Invalid date format — expected ISO 8601 UTC (e.g. 2025-06-15T09:00:00.000Z)" },
);
