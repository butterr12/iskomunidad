-- Soft-delete conversations tied to declined/withdrawn requests that were
-- never cleaned up before the soft-delete mechanism was introduced.
-- These are invisible in getConversations but still returned by the
-- existing-conversation lookup in getOrCreateConversation, creating a
-- dead-end where users can never re-message each other.
UPDATE "conversation" c
SET "deleted_at" = COALESCE(mr."resolved_at", mr."updated_at"),
    "delete_kind" = 'request',
    "updated_at" = NOW()
FROM "message_request" mr
WHERE mr."conversation_id" = c."id"
  AND mr."status" IN ('declined', 'withdrawn')
  AND c."is_request" = true
  AND c."deleted_at" IS NULL;
