# Phase 1: Security Guards

## Goal

Eliminate high-risk exploit and account-status gaps.

## Why This Phase First

- It addresses the only P0 issue (stored link scheme abuse).
- It closes policy/security gaps around banned/deleted users.
- It minimizes blast radius quickly without large refactors.

## Implementation Steps

1. Add server-side link URL normalization and scheme allowlist (`http`, `https`) for post creation paths.
2. Reject invalid `linkUrl` values in both user and admin post create schemas.
3. Add defensive rendering guard for links so invalid values are not rendered as clickable anchors.
4. Enforce `status = "active"` for profile resolution used by public profile actions.
5. Enforce `status = "active"` for message-target lookup and follow-target lookup.
6. Return consistent, non-enumerating errors for inactive/non-existent targets where needed.

## Success Criteria

- Attempts to create posts with `javascript:`, `data:`, `file:`, `vbscript:` URLs fail validation.
- Existing bad links in DB are rendered as plain text or hidden, never clickable.
- Profile action for banned/deleted users returns "not found" behavior.
- Follow and DM creation cannot target banned/deleted users.
- Unit/integration tests cover:
  - link URL validation pass/fail cases
  - inactive user follow/message/profile lookup paths

## Suggested Verification

1. Add tests for link validation helper and create-post action validation.
2. Add tests for `followUser` and `getOrCreateConversation` against inactive targets.
3. Manual smoke test: create post with valid `https://` link and confirm normal behavior.
