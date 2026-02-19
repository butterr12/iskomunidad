# Code Audit Checklist (2026-02-19)

Audit scope: full repo review + static analysis + dependency/security scan.

Sources used:
- Manual code review (server actions, API routes, auth/session, messaging, events, settings, navigation, accessibility)
- `npm run lint` (6 errors, 8 warnings)
- `npx tsc --noEmit` (pass)
- `npx -y react-doctor@latest . --verbose` (score 87/100, 72 warnings across 38 files)
- `npx -y knip` (dead code + dependency hygiene findings)
- `npm audit --omit=dev --json` (6 vulnerabilities: 2 high, 4 moderate)
- `npm run build` (pass)

---

## P0 - Fix First (correctness/security)

- [x] **[P0-01] Re-run moderation for edited events in AI mode (current logic bypasses it)**
  - Files: `src/actions/events.ts:354`, `src/actions/events.ts:367`, `src/actions/events.ts:392`, `src/actions/events.ts:198`
  - Risk: event edits in AI mode are not re-moderated; previously approved content can be edited into disallowed content and remain approved.
  - Task: switch edit flow to approval-mode aware logic (`manual`, `auto`, `ai`) and call `moderateContent` for AI mode edits.
  - Done when: editing a flagged event in AI mode returns rejected/draft behavior consistently with create flow.
  - Codex review (2026-02-19): ✅ Correct. Edit flow now uses approval mode and re-runs moderation for `ai`.

- [x] **[P0-02] Prevent status trap on event edits (rejected items stay rejected forever in auto/ai path)**
  - Files: `src/actions/events.ts:392`
  - Risk: if `existing.status` is `rejected`, edit success still returns `rejected` even after valid changes; no clear resubmission path.
  - Task: define explicit status transition policy for edits (e.g., resubmit as `draft` or re-moderate to approved/rejected).
  - Done when: a rejected event can be edited and resubmitted via a deterministic path.
  - Codex review (2026-02-19): ✅ Correct. Status is now deterministically recomputed from mode (`manual -> draft`, `auto -> approved`, `ai -> moderated`).

- [x] **[P0-03] Make university selection + flair sync atomic**
  - Files: `src/actions/auth.ts:201`, `src/actions/auth.ts:206`
  - Risk: concurrent requests can cause university update to no-op while flair sync still runs, creating inconsistent profile/flair state.
  - Task: use transaction + check update rowcount before syncing flair; fail if no row was updated.
  - Done when: concurrent submissions cannot produce flair/university mismatch.
  - Codex review (2026-02-19): ⚠️ Partial. Rowcount guard is implemented, but update + flair sync are not in one DB transaction, so atomicity is still not guaranteed on sync failure.

- [x] **[P0-04] Handle follow race safely (check-then-insert on unique pair)**
  - Files: `src/actions/follows.ts:50`, `src/actions/follows.ts:59`, `src/lib/schema.ts:376`
  - Risk: simultaneous follow requests can throw unique-constraint errors and surface as failures.
  - Task: replace with `onConflictDoNothing` or catch unique violation and treat as idempotent success.
  - Done when: repeated/concurrent follows are always safe/idempotent.
  - Codex review (2026-02-19): ✅ Correct. Uses `onConflictDoNothing` on `(followerId, followingId)` and only emits notifications for new inserts.

- [x] **[P0-05] Validate message target user before creating conversations**
  - Files: `src/actions/messages.ts:112`, `src/actions/messages.ts:154`
  - Risk: invalid `targetUserId` can fail on participant insert (FK error), bubbling unexpected exceptions.
  - Task: add target-user existence check at start of `getOrCreateConversation` and return clean `ActionResult` error.
  - Done when: invalid target IDs return graceful `success: false` responses without uncaught server exceptions.
  - Codex review (2026-02-19): ✅ Mostly correct. Existence check and graceful errors were added.
  - Codex review note: `targetUserId` is now hard-validated as UUID; this is only safe if auth user IDs are guaranteed UUIDs in production.

- [x] **[P0-06] Prevent messaging screen from getting stuck on failed auto-open**
  - Files: `src/app/(explorer)/messages/page.tsx:75`, `src/app/(explorer)/messages/page.tsx:98`
  - Risk: if `getOrCreateConversation` throws, `initializing` may never reset.
  - Task: wrap `openConversation` in `try/catch/finally`; ensure `setInitializing(false)` in `finally`.
  - Done when: malformed `?with=` never leaves page in a blocked state.
  - Codex review (2026-02-19): ✅ Correct. `openConversation` is wrapped in `try/catch/finally` with `setInitializing(false)` in `finally`.

- [x] **[P0-07] Fix optimistic message de-dup collision logic**
  - Files: `src/components/messages/chat-panel.tsx:167`, `src/components/messages/chat-panel.tsx:479`
  - Risk: matching optimistic messages by `senderId + body` can drop/hide the wrong message when content repeats.
  - Task: correlate optimistic entries via stable client IDs echoed/linked to server response, not by body text.
  - Done when: sending duplicate text messages in sequence does not lose or merge entries incorrectly.
  - Codex review (2026-02-19): ⚠️ Partial. Body-based dedup was removed and ID-based matching is better.
  - Codex review note: there is still a race where socket `new_message` can arrive before the action response updates optimistic `id`, leaving stale optimistic entries.

- [x] **[P0-08] Stop revoking optimistic image preview URLs before send completes**
  - Files: `src/components/messages/chat-panel.tsx:287`, `src/components/messages/chat-panel.tsx:358`, `src/components/messages/chat-panel.tsx:367`
  - Risk: preview URL can be revoked immediately after enqueue, causing broken optimistic image rendering.
  - Task: defer URL revocation until optimistic item is removed/failed-retried cleanup runs.
  - Done when: optimistic image previews remain visible until confirmed or explicitly cleared.
  - Codex review (2026-02-19): ⚠️ Partial. URL revocation was deferred for optimistic send flow, fixing the original broken-preview issue.
  - Codex review note: `clearImage()` no longer revokes the unsent preview URL, introducing a blob URL leak when users remove a selected image before sending.

- [x] **[P0-09] Check `updateUser` errors in settings flows**
  - Files: `src/app/settings/page.tsx:334`, `src/app/settings/page.tsx:362`
  - Risk: UI can show success/updated state even when backend rejects update.
  - Task: inspect return shape from `updateUser` and gate success path on absence of `error`.
  - Done when: failed avatar/profile updates surface error and do not update local success state.
  - Codex review (2026-02-19): ✅ Correct. Both settings save paths now gate success on `updateUser` error state.

- [x] **[P0-10] Enforce server-side date validation for events/gigs/admin create paths**
  - Files: `src/actions/events.ts:26`, `src/actions/events.ts:213`, `src/actions/events.ts:361`, `src/actions/admin.ts:402`, `src/actions/admin.ts:742`, `src/actions/gigs.ts:127`
  - Risk: invalid/illogical dates (`Invalid Date`, end < start) can be persisted or throw DB/runtime errors.
  - Task: add Zod refinements for valid ISO date parsing and chronological constraints.
  - Done when: all create/update paths reject invalid or inverted date ranges with explicit messages.
  - Codex review (2026-02-19): ⚠️ Partial. Create schemas now validate date format and chronology.
  - Codex review note: event update chronology check only runs when both dates are provided in one payload; single-field edits can still produce `endDate < startDate`.

---

## P1 - High Priority (behavior, UX, accessibility, reliability)

- [ ] **[P1-01] Remove zoom lock from global viewport settings**
  - Files: `src/app/layout.tsx:43`, `src/app/layout.tsx:44`
  - Risk: users with low vision cannot pinch-zoom (WCAG issue, major mobile accessibility regression).
  - Task: remove `maximumScale: 1` and `userScalable: false`.
  - Done when: mobile browser zoom is available.

- [ ] **[P1-02] Fix `?post=` deep-link behavior with paginated community feed**
  - Files: `src/components/community/community-tab.tsx:107`, `src/components/community/community-tab.tsx:226`, `src/actions/posts.ts:186`
  - Risk: links from notifications fail for posts not loaded in initial pages.
  - Task: on `postParam`, call `getPostById` directly (or load pages until found) before selecting.
  - Done when: any valid `?post=<id>` opens post detail regardless of feed pagination state.

- [ ] **[P1-03] Clear current lint-blocking React correctness errors**
  - Files: `src/components/consent-gate.tsx:391`, `src/components/consent-gate.tsx:392`, `src/components/consent-gate.tsx:400`, `src/components/events/events-tab.tsx:110`, `src/components/messages/compose-dialog.tsx:48`, `src/components/messages/compose-dialog.tsx:69`
  - Risk: refs/state patterns flagged as unsafe can lead to render inconsistencies and cascading rerenders.
  - Task: refactor ref initialization to effects/memoized values and remove direct setState-in-effect patterns.
  - Done when: `npm run lint` has zero errors.

- [ ] **[P1-04] Add Suspense boundaries for all `useSearchParams` consumers**
  - Files: `src/components/community/community-tab.tsx:84`, `src/components/gigs/gigs-tab.tsx:64`, `src/components/events/events-tab.tsx:47`, `src/app/(explorer)/messages/page.tsx:19`, `src/app/(explorer)/community/page.tsx:14`, `src/app/(explorer)/gigs/page.tsx:14`, `src/app/(explorer)/events/page.tsx:14`
  - Risk: entire routes bail out to CSR unexpectedly, hurting performance and hydration behavior.
  - Task: wrap search-param clients in `<Suspense>` from parent page components.
  - Done when: React Doctor no longer reports `nextjs-no-use-search-params-without-suspense`.

- [ ] **[P1-05] Correct follower notification content classification**
  - Files: `src/actions/follows.ts:68`, `src/lib/notification-preferences.ts:17`
  - Risk: `new_follower` notifications are treated as `post` notifications and can be muted unintentionally.
  - Task: add dedicated notification category/type handling (or use neutral type not tied to post preference).
  - Done when: follow notifications are controlled independently and predictably.

- [ ] **[P1-06] Replace invalid social footer anchors (`href="#"`)**
  - Files: `src/components/landing-page.tsx:365`, `src/components/landing-page.tsx:368`, `src/components/landing-page.tsx:371`
  - Risk: keyboard/screen-reader users hit dead links; poor SEO/a11y hygiene.
  - Task: use real URLs or semantic buttons when no destination exists.
  - Done when: no placeholder anchors remain.

- [ ] **[P1-07] Add accessible names to icon-only action buttons**
  - Files: `src/components/messages/chat-panel.tsx:571`, `src/components/messages/chat-panel.tsx:592`, `src/components/community/comment-section.tsx:58`, `src/components/admin/post-table.tsx:112`, `src/components/admin/post-table.tsx:117`, `src/components/admin/post-table.tsx:121`, `src/components/events/events-tab.tsx:170`
  - Risk: controls are ambiguous/unusable for assistive tech.
  - Task: add `aria-label` or visible text with `sr-only` labels for icon-only controls.
  - Done when: icon-only interactive elements expose descriptive accessible names.

- [ ] **[P1-08] Harden route protection beyond cookie existence check**
  - Files: `src/proxy.ts:26`, `src/proxy.ts:28`
  - Risk: any arbitrary cookie value passes proxy gate and loads protected shell until later auth checks fail.
  - Task: validate session server-side in proxy or redirect unauthenticated users using verified auth state.
  - Done when: fake session cookies no longer pass route gate.

- [ ] **[P1-09] Define production strategy for distributed rate limiting**
  - Files: `src/lib/rate-limit.ts:4`, `src/lib/rate-limit.ts:29`
  - Risk: in-memory limiter resets on deploy/restart and is bypassed across multiple instances.
  - Task: move to shared store (Redis/Upstash) for production tiers (`auth`, `create`, `upload`, `proxy`).
  - Done when: limits are consistent across instances and restarts.

- [ ] **[P1-10] Patch production dependency vulnerabilities (`npm audit`)**
  - Files: `package-lock.json` (transitive tree), `package.json:52`
  - Risk: known advisories in dependency graph (`fast-xml-parser` high, `esbuild` chain moderate).
  - Task: update affected packages (including `drizzle-kit` path) and re-run audit.
  - Done when: `npm audit --omit=dev` reports zero high/moderate findings (or documented accepted risk).

---

## P2 - Medium Priority (performance, maintainability, UX polish)

- [ ] **[P2-01] Add metadata for messages route**
  - Files: `src/app/(explorer)/messages/page.tsx:1`
  - Risk: weaker SEO/social metadata consistency.
  - Task: export `metadata` or move client page into server wrapper with metadata.
  - Done when: page includes title/description metadata.

- [ ] **[P2-02] Replace `<img>` with `next/image` where appropriate**
  - Files: `src/components/landmark-map.tsx:65`, `src/components/landmark-map.tsx:158`, `src/components/messages/chat-panel.tsx:545`, `src/components/messages/message-bubble.tsx:70`
  - Risk: slower LCP and unnecessary bandwidth.
  - Task: migrate to `next/image` or justify exceptions with documented reason.
  - Done when: lint/react-doctor `no-img-element` warnings are cleared or intentionally suppressed with rationale.

- [ ] **[P2-03] Replace array-index React keys in dynamic lists**
  - Files: `src/components/landmark-map.tsx:159`
  - Risk: potential UI/state mismatch when list order changes.
  - Task: derive stable key from URL/content hash instead of index.
  - Done when: no index keys in reorderable/filtered list renders.

- [ ] **[P2-04] Remove permanent `will-change` on map markers**
  - Files: `src/components/landing-map.tsx:174`, `src/components/landmark-map.tsx:380`
  - Risk: unnecessary GPU memory pressure.
  - Task: toggle `will-change` only during active animation states.
  - Done when: permanent `will-change` usage is removed.

- [ ] **[P2-05] Decompose giant components and centralize state transitions**
  - Files: `src/app/settings/page.tsx:81`, `src/components/community/community-tab.tsx:81`, `src/components/messages/chat-panel.tsx:49`, `src/components/events/event-form-wizard.tsx:72`, `src/components/landing-page.tsx:111`
  - Risk: high change-risk, low testability, and frequent regression potential.
  - Task: split by feature sections + move related state to reducers/custom hooks.
  - Done when: each component has clear boundaries and smaller focused subcomponents.

- [ ] **[P2-06] Remove broad file-level `eslint-disable` usage**
  - Files: `src/app/settings/page.tsx:1`, `src/components/gigs/gigs-tab.tsx:1`, `src/components/gigs/swipe-deck.tsx:1`, `src/components/gigs/create-gig-form.tsx:1`, `src/components/community/community-tab.tsx:1`, `src/components/community/create-post-form.tsx:1`, `src/components/events/event-form-wizard.tsx:1`, `src/components/admin/post-form.tsx:1`, `src/app/admin/events/create/page.tsx:1`, `src/app/admin/gigs/create/page.tsx:1`, `src/app/admin/locations/create/page.tsx:1`
  - Risk: lint suppressions can hide real bugs and stale dependencies.
  - Task: remove blanket disables and use targeted fixes/single-rule suppressions only when justified.
  - Done when: no broad top-level disables remain.

- [ ] **[P2-07] Optimize swipe reset flow (avoid N sequential server calls)**
  - Files: `src/components/gigs/gigs-tab.tsx:131`
  - Risk: poor performance and long UI stalls with many gigs.
  - Task: add batch endpoint/server action for reset or parallelize with bounded concurrency.
  - Done when: reset operation is near-constant UX time for large lists.

- [ ] **[P2-08] Reduce repeated full-user vote/swipe/rsvp scans on feed endpoints**
  - Files: `src/actions/posts.ts:78`, `src/actions/posts.ts:212`, `src/actions/events.ts:74`, `src/actions/events.ts:112`, `src/actions/gigs.ts:65`, `src/actions/follows.ts:372`
  - Risk: per-request DB cost scales with total historical interactions, not current page size.
  - Task: query interaction rows scoped to returned IDs only.
  - Done when: interaction query size scales with page payload, not user history.

- [ ] **[P2-09] Add robust error handling around external photo proxy fetches**
  - Files: `src/app/api/places-photo/route.ts:40`
  - Risk: network/runtime fetch exceptions can produce unhandled 500s.
  - Task: wrap upstream fetch in `try/catch` and return controlled error response.
  - Done when: transient upstream failures return predictable JSON/HTTP responses.

- [ ] **[P2-10] Align event edit UX warning with real approval mode**
  - Files: `src/components/events/edit-event-page-client.tsx:92`, `src/components/events/event-form-wizard.tsx:67`, `src/components/events/event-form-wizard.tsx:226`
  - Risk: UI warning about re-approval may be incorrect because `autoApprove` defaults true and is not sourced from server setting.
  - Task: fetch/pass actual approval mode into edit wizard.
  - Done when: edit UI messaging always matches server-side status behavior.

---

## P3 - Hygiene Backlog (cleanup / consistency)

- [ ] **[P3-01] Clean up unused file and exports from Knip report**
  - Files: `src/components/admin/confirm-dialog.tsx`, `src/actions/follows.ts`, `src/lib/auth-client.ts`, `src/lib/events.ts`, `src/lib/posts.ts`, `src/lib/flair-service.ts`, `src/emails/magic-link.tsx`, `src/emails/reset-password.tsx`, `src/emails/verify-email.tsx`
  - Task: remove or wire currently unused symbols/files.

- [ ] **[P3-02] Resolve unlisted dependency declarations**
  - Files: `server.ts:1`, `src/components/landmark-map.tsx:11`, `postcss.config.mjs:1`
  - Task: explicitly declare required dependencies (`@next/env`, `geojson`, and any required PostCSS package resolution strategy).

- [ ] **[P3-03] Remove unused deps/devDeps flagged by Knip**
  - Files: `package.json:32`, `package.json:44`
  - Task: remove `react-email` and `@react-email/preview-server` if truly unused, or wire intended usage.

- [ ] **[P3-04] Add review coverage for high-churn files**
  - Files: `src/app/settings/page.tsx`, `src/components/messages/chat-panel.tsx`, `src/components/community/community-tab.tsx`, `src/components/events/event-form-wizard.tsx`
  - Task: add targeted regression tests (unit/integration) for core workflows.

---

## Validation Commands (run after each batch)

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npx -y react-doctor@latest . --verbose`
- [ ] `npx -y knip`
- [ ] `npm audit --omit=dev --json`
- [ ] `npm run build`

---

## Suggested Execution Order

- [ ] Phase 1: Complete all P0 items.
- [ ] Phase 2: Clear P1 accessibility/reliability + lint errors.
- [ ] Phase 3: Address P2 performance/maintainability.
- [ ] Phase 4: Clean P3 hygiene backlog and dependency cleanup.
