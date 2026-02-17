const CONTENT_LABELS: Record<string, string> = {
  post: "community post",
  gig: "gig listing",
  event: "campus event",
  landmark: "landmark",
};

const GUIDELINES_REMINDER =
  "\n\nReminder: All content should follow our community guidelines — " +
  "be respectful, avoid spam, and keep things relevant to the campus community. " +
  "Feel free to revise and resubmit!";

export function buildApprovalMessage(
  contentType: string,
  title: string,
): string {
  const label = CONTENT_LABELS[contentType] ?? contentType;
  return `Your ${label} "${title}" has been approved and is now visible to the community.`;
}

export function buildRejectionMessage(
  contentType: string,
  title: string,
  reason?: string,
): string {
  const label = CONTENT_LABELS[contentType] ?? contentType;
  const base = `Your ${label} "${title}" was not approved.`;
  const reasonLine = reason ? `\n\nReason: ${reason}` : "";
  return base + reasonLine + GUIDELINES_REMINDER;
}
