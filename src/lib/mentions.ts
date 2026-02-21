export const MENTION_WORD_CHARS = "a-zA-Z0-9_";
export const MENTION_BOUNDARY = `[^${MENTION_WORD_CHARS}]`;

const MENTION_PATTERN = new RegExp(
  `(^|${MENTION_BOUNDARY})@([${MENTION_WORD_CHARS}]{3,30})`,
  "g",
);

export type MentionPart =
  | { kind: "text"; value: string }
  | { kind: "mention"; username: string };

export function splitTextWithMentions(text: string): MentionPart[] {
  if (!text) return [{ kind: "text", value: "" }];

  const parts: MentionPart[] = [];
  let cursor = 0;
  const mentionRegex = new RegExp(MENTION_PATTERN);

  for (const match of text.matchAll(mentionRegex)) {
    const start = match.index ?? 0;
    const prefix = match[1] ?? "";
    const username = match[2];
    const mentionStart = start + prefix.length;
    const mentionEnd = mentionStart + username.length + 1; // +1 for "@"

    if (cursor < start) {
      parts.push({ kind: "text", value: text.slice(cursor, start) });
    }
    if (prefix) {
      parts.push({ kind: "text", value: prefix });
    }

    parts.push({ kind: "mention", username });
    cursor = mentionEnd;
  }

  if (cursor < text.length) {
    parts.push({ kind: "text", value: text.slice(cursor) });
  }

  if (parts.length === 0) {
    return [{ kind: "text", value: text }];
  }

  return parts;
}

export function extractMentionUsernames(text: string): string[] {
  const seen = new Set<string>();
  const usernames: string[] = [];

  for (const part of splitTextWithMentions(text)) {
    if (part.kind !== "mention") continue;
    const normalized = part.username.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    usernames.push(normalized);
  }

  return usernames;
}
