# Campus Match Implementation Guide
Single source of truth for Campus Match (anonymous queue + anonymous chat + mutual connect to DM).

## 1. Purpose
Campus Match lets users join a queue, get paired anonymously, chat, and mutually connect into a normal DM.  
This guide is decision-complete. Implementation must follow this document and its Q&A appendix.

## 2. Non-Negotiable Rules
1. Always read Appendix A (Q&A Log) before starting work.
2. Implement only scoped tasks for the current phase.
3. Do not introduce ad-hoc product decisions outside this guide.
4. If a new question appears, add it to Appendix A immediately.
5. If a new answer replaces an old answer, mark old row as `superseded`.
6. Keep phase status updated (`not started`, `in progress`, `done`).
7. Keep this file updated after every phase.
8. Any new question asked must be logged in this file.

## 3. Working Method (Phase by Phase)
1. Start of phase:
- Review dependencies from prior phases.
- Confirm no unresolved blocking questions.
- Confirm locked decisions still align with implementation.

2. During phase:
- Build only listed deliverables.
- Keep implementation notes and risk notes in this file.
- Keep names, enums, and interfaces aligned with this guide.

3. End of phase:
- Run validation checks for that phase.
- Document completed work, deferred work, and risks.
- Update phase status.

## 4. Phase Status Tracker

| Phase | Name | Status | Owner | Last Updated |
|---|---|---|---|---|
| 0 | Setup and Governance | done | Claude | 2026-02-19 |
| 1 | Data Model and Migrations | done | Codex | 2026-03-06 |
| 2 | Backend Core Logic | done | Codex | 2026-03-06 |
| 3 | Realtime and Persistence | done | Codex | 2026-03-06 |
| 4 | User UX (Messages + Settings) | done | Codex | 2026-03-06 |
| 5 | Admin Moderation | done | Codex | 2026-03-06 |
| 6 | Hardening and QA | in progress | Codex | 2026-03-06 |
| 7 | Reliability + UX Compliance | done | Claude | 2026-03-06 |
| 8 | v1 Stabilize + UX Polish | done | Codex | 2026-03-06 |

### Completion Notes (2026-03-06)
- Phase 1: Added `cm_ban` table and indexes for active-ban checks and expiry reporting.
- Phase 2: Added secure participant lock helper (`lockActiveSessionForParticipant`) and applied auth-first guard for `skip`, `end`, `report`, and `block`. Added message pagination action and typed send-message payload return.
- Phase 3: Added 30-second worker in `server.ts`, advisory-lock-safe round execution, and full socket event fanout for Campus Match lifecycle.
- Phase 4: Replaced mock/teaser UX with real Messages-only Campus Match panel (`idle`, `waiting`, `in_session`, `banned`) and integrated settings + global indicators.
- Phase 5: Added admin reports actions and admin reports route with transcript preview, resolve, temp-ban, and ban-lift flows.
- Phase 6: Static checks and manual QA matrix are the active verification wave.
- Phase 7: Fixed message ownership (senderId vs alias), moved heartbeat to SocketProvider for app-wide queue presence, auto-navigate on promotion, added error/loading UX, emitted state events for cleanup removals, added Block action to chat UI, added admin notifications on report.
- Phase 8: Added idempotent connect/promotion race handling, guarded same-campus joins when university is missing, fixed anon tab URL sync precedence, improved transcript pagination/scroll behavior (chronological merge + top "Load older" + scroll preservation), disabled duplicate session actions with clearer end/skip/report/block feedback, and made the Anon tab urgency indicator stateful.

## 5. Locked Product Decisions
- Feature label: **Campus Match**
- Entrypoint: Messages tab section
- Connect mode: mutual opt-in
- Queue scope: user-selectable (`same-campus`, `all-campuses`)
- Default scope: last-used (stored per account)
- Alias: user-defined, saved default alias
- Alias validation: 3–24 chars, safe chars
- Queue/session presence: app-wide persistence
- Max concurrency: single active state per user
- Matching strategy: random eligible
- Matching cadence: 30-second rounds
- Waiting behavior: retry rounds
- Offline stale timeout: 90 seconds
- Rematch policy: cooldown rematch (24h)
- Message types in anon chat: text + images
- Moderation model: report-driven only
- Safety actions: report + block + end
- Block scope: global block
- Relationship exclusion: exclude existing DMs
- Connect request behavior: sticky until end
- Decline behavior: clear both connect requests to `none` (retry allowed)
- Session hard limits: none
- Skip behavior: skip + requeue
- Leave behavior: end session for both
- Off-page match notification: in-app toast + open CTA
- Notification depth: in-app only (no browser/system notifications)
- Global indicator: nav badge + top pill
- Promotion behavior: same conversation becomes DM
- Promotion identity reveal: full profile identity
- Promotion transcript behavior: carry transcript into DM
- Promotion side effect: auto-follow both users, override follow privacy
- Privacy model: separate anon toggle (`allowAnonQueue`)
- Report admin surface: dedicated admin queue
- Ban model: temporary bans (default 7 days)
- Data retention: indefinite
- Rollout: full release
- Scale target: up to 500 concurrent queued users
- Plan doc path: `docs/anon-chat-plan.md`

## 6. Architecture Summary
- Reuse existing `conversation`, `conversation_participant`, `message`, `message_request` for promoted DM continuity.
- Add Campus Match metadata/state tables for queue, anon session, reports, and blocks.
- Use existing Socket.IO infrastructure in `server.ts` and `SocketProvider` for realtime events.
- Keep existing DM flows intact; only add filters/guards where required.

## 7. Detailed Phase Plan

## Phase 0: Setup and Governance
### Scope
- Establish planning artifact and guardrails.

### Tasks
1. Create and maintain `docs/anon-chat-plan.md` (this file).
2. Add emergency kill switch: `admin_setting.key = "campusMatchEnabled"` default `true`.
3. Ensure all Campus Match actions short-circuit when kill switch is disabled.
4. Add implementation checklist sections (DB/API/UI/Admin/QA) to this file.

### Done When
- Kill switch exists and is enforced.
- Document is committed and used as implementation tracker.

---

## Phase 1: Data Model and Migrations
### Scope
- Add required tables, enums, constraints, and indexes.

### Required Enums
- `match_scope`: `same-campus | all-campuses`
- `anon_session_status`: `active | ended | promoted`
- `report_status`: `pending | resolved`

### Required Tables
1. `cm_preference`
2. `cm_queue_entry`
3. `cm_session`
4. `cm_session_participant`
5. `cm_report`
6. `cm_block`
7. `cm_rematch_cooldown` (for 24h rematch cooldown tracking)
8. `cm_message`

### Constraints and Indexes
1. Unique queue entry per user (`cm_queue_entry` unique on `user_id`; entries are deleted on match/leave).
2. Unique `cm_session_participant (session_id, user_id)`.
3. Unique `cm_block (blocker_id, blocked_id)`.
4. Unique `cm_report (session_id, reporter_id)`.
5. Queue indexes: (`status`, `scope`, `heartbeat_at`), plus `user_id`.
6. Report indexes: (`status`, `created_at`), plus `reported_user_id`.
7. Cooldown indexes: pair key + `expires_at`.

### Done When
- Drizzle schema updated.
- Migration SQL created and applied.
- Constraints verified.

---

## Phase 2: Backend Core Logic
### Scope
- Implement Campus Match actions and matchmaking engine.

### New Action Module
- `src/actions/campus-match.ts`

### Required Server Actions
- `getCampusMatchState()`
- `getCampusMatchPreferences()`
- `updateCampusMatchPreferences(input)`
- `joinCampusMatchQueue(input)`
- `leaveCampusMatchQueue()`
- `heartbeatCampusMatchQueue()`
- `skipCampusMatchSession(input)`
- `endCampusMatchSession(input)`
- `requestCampusMatchConnect(input)`
- `declineCampusMatchConnect(input)`
- `reportCampusMatchUser(input)`

### Matching Rules
1. Random eligible matching every 30 seconds.
2. Immediate match attempt on queue join.
3. Respect `allowAnonQueue`.
4. Respect scope (`same-campus` vs `all-campuses`).
5. Exclude existing DM pairs.
6. Enforce rematch cooldown (24h).
7. Enforce global block.
8. Expire stale queue entries after 90 seconds without heartbeat.
9. Enforce single active state per user (waiting or active session, never both/multiple).

### Session Rules
1. Connect request remains pending until session ends.
2. Decline does not end session; connect can be retried.
3. Skip ends current session and immediately requeues.
4. End chat ends session for both.
5. Mutual connect promotes session to DM.
6. Promotion reveals full identity and keeps transcript.
7. Promotion auto-follows both users idempotently, ignoring follow privacy.

### Global Block Integration
Apply block checks in:
- `src/actions/messages.ts` (`getOrCreateConversation`, `sendMessage`)
- `src/actions/follows.ts` (`followUser`, `searchUsers`)
- Campus Match matching and interaction actions

### Done When
- All required actions exist with validation and authorization.
- Matching and session transitions satisfy all locked rules.
- Block behavior is enforced platform-wide for future interactions.

---

## Phase 3: Realtime and Persistence
### Scope
- Add realtime lifecycle events and app-wide persistent state.

### Server Work
1. Extend `server.ts` with 30-second matching worker.
2. Use DB/advisory lock to avoid overlapping round execution.
3. Emit user-room events for queue/session updates.

### Socket Events
- `campus_match_state_changed`
- `campus_match_found`
- `campus_match_session_ended`
- `campus_match_connect_changed`
- `campus_match_promoted`

### Client Provider Work
- Extend `src/components/providers/socket-provider.tsx` to store Campus Match state globally.
- Show in-app toast with “Open chat” CTA when matched off-page.
- No browser notification permission flow.

### Done When
- Queue/session state updates in real time across app pages.
- Off-page matching consistently triggers in-app toast + CTA.

---

## Phase 4: User UX (Messages + Settings)
### Scope
- Build user-facing Campus Match UI and settings controls.

### Messages UI
1. Add Campus Match section/tab in `src/components/messages/conversation-list.tsx`.
2. Idle state UI:
- Scope selector (`same-campus`, `all-campuses`)
- Alias input (prefilled by saved alias)
- Join queue button
3. Waiting state UI:
- Queue status
- Round countdown/next attempt
- Leave queue button
4. Active anon session UI:
- Alias-only identities pre-connect
- Text + image messaging
- Actions: Connect, Decline Connect, Skip + Requeue, End Chat, Report
5. Promotion handling:
- Swap to normal DM presentation in same conversation
- Reveal full profile identity

### Settings UI
Add to `src/app/settings/page.tsx`:
- `allowAnonQueue` toggle
- saved default alias field
- last-used scope persistence (account-level)

### Global Indicators
- Messages nav badge/dot for active queue/session state
- top status pill showing current Campus Match state

### Done When
- Full Campus Match flow is usable from Messages.
- Settings persist and affect behavior.
- Indicators show app-wide status.

---

## Phase 5: Admin Moderation
### Scope
- Add dedicated moderation queue and admin actions.

### Admin Route
- `src/app/admin/campus-match-reports/page.tsx`

### Admin Actions
Add in `src/actions/admin.ts`:
- `adminGetCampusMatchReports(status?)`
- `adminResolveCampusMatchReport(input)`
- `adminBanUserFromCampusMatchReport(input)`
- `adminLiftCampusMatchBan(input)`

### Admin Navigation Wiring
- Update `src/components/admin/admin-sidebar.tsx`
- Update `src/components/admin/admin-header.tsx`

### Report Flow Requirements
On user report:
1. End session immediately.
2. Apply global block.
3. File report with metadata/transcript references.
4. Emit/create admin visibility notification.

### Done When
- Admins can review, resolve, and ban from Campus Match reports.
- Report records include adequate context for moderation.

---

## Phase 6: Hardening and QA
### Scope
- Verify correctness, regressions, and operational readiness.

### Required Validation Areas
1. Existing DM behavior unaffected.
2. Identity masking pre-connect, full reveal post-connect.
3. Queue reconnection and stale expiry correctness.
4. Skip/end/connect/decline transitions.
5. Global block enforcement for future interactions.
6. Exclusion of existing DMs from new Campus Match pairing.
7. Rematch cooldown enforcement.
8. Auto-follow behavior on promotion.
9. Admin report queue functionality.
10. Realtime reliability under expected concurrency.

### Deterministic Manual QA Matrix (2026-03-06)
| ID | Scenario | Expected Result | Status |
|---|---|---|---|
| CM-QA-01 | Unauthorized user calls `skip/end/report/block` on foreign session | Action rejected with `Not allowed to manage this session`; session unchanged | pending manual run |
| CM-QA-02 | Participant performs each session action once under lock | Single transition per action; no duplicate state transitions | pending manual run |
| CM-QA-03 | User joins queue, then stops heartbeats | Entry removed after stale timeout window | pending manual run |
| CM-QA-04 | Two users match while both clients open | Both clients receive realtime state/session updates | pending manual run |
| CM-QA-05 | User declines connect | Both `connectRequested` flags reset to `none`; reconnect can be retried | pending manual run |
| CM-QA-06 | Mutual connect accepted by both participants | Same conversation ID promoted to DM with anon transcript continuity | pending manual run |
| CM-QA-07 | Match found while user is off Messages page | In-app toast appears with `Open chat` CTA to `/messages?tab=anon` | pending manual run |
| CM-QA-08 | User disables `allowAnonQueue` | Join and queueing actions blocked for that user | pending manual run |
| CM-QA-09 | Temp-banned user attempts to queue or interact | Blocked; UI shows ban state with expiry | pending manual run |
| CM-QA-10 | Ban expiry passes | Eligibility automatically restored without manual DB edits | pending manual run |
| CM-QA-11 | Admin reviews report queue | Reason + recent transcript preview shown (last 20) | pending manual run |
| CM-QA-12 | Existing DM, requests, follow/search flows | No regression in normal messaging/request behavior | pending manual run |

### Done When
- Regression suite and manual scenario checks pass.
- No unresolved P0/P1 issues for Campus Match launch.

---

## Phase 7: Reliability + UX Compliance
### Scope
- Fix correctness and UX gaps found during code audit before new features.

### Fixes (P1)
1. **Message ownership** — Compare `senderId` against auth session user ID instead of alias (alias collision bug).
2. **Global heartbeat** — Moved heartbeat interval from panel to `SocketProvider` so queue entry stays alive when navigating away.
3. **Promotion auto-navigate** — On `campus_match_promoted`, auto-navigate to promoted DM instead of only showing toast CTA.

### Improvements (P2)
4. **Error UX** — Added error state with retry button when `getCampusMatchState` query fails (was infinite spinner).
5. **Cleanup event emission** — Cleanup DELETEs in `runCampusMatchRound` now use `RETURNING` to collect removed user IDs and emit `campus_match_state_changed` so their UI updates immediately.
6. **Block action** — Exposed `blockCampusMatchUser` in the chat panel UI with confirmation dialog.
7. **Admin notification on report** — `reportCampusMatchUser` now calls `createNotification({ type: "cm_report" })` and notification table renders the badge.

### Done When
- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` succeeds.

## 8. Public API / Type Contract (Canonical)
```ts
type MatchScope = "same-campus" | "all-campuses";
type QueueStatus = "idle" | "waiting" | "matched";
type AnonSessionStatus = "active" | "ended" | "promoted";
type ConnectState = "none" | "pending_me" | "pending_them" | "mutual";

type CampusMatchMessageData = {
  id: string;
  sessionId: string;
  senderId: string | null;
  senderAlias: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
};

type CampusMatchPreferences = {
  allowAnonQueue: boolean;
  defaultAlias: string | null;
  lastScope: MatchScope;
};

type CampusMatchState = {
  status: "idle" | "waiting" | "in_session" | "banned";
  preferences: CampusMatchPreferences;
  queue: null | {
    scope: MatchScope;
    alias: string;
    waitingSince: string;
    nextRoundAt: string;
  };
  session: null | {
    conversationId: string;
    sessionStatus: AnonSessionStatus;
    myAlias: string;
    partnerAlias: string;
    connectState: ConnectState;
  };
  ban: null | {
    expiresAt: string;
    reason: string | null;
  };
};
```

## 9. Test Cases and Scenarios
1. Queue join + match in each scope.
2. Last-used scope persistence across sessions/devices.
3. 90-second stale queue expiry.
4. Existing-DM exclusion enforcement.
5. 24h rematch cooldown enforcement.
6. Connect request sticky state.
7. Connect decline and retry behavior.
8. Mutual connect promotion to same conversation.
9. Transcript continuity in promoted DM.
10. Auto-follow creation for both users on promotion.
11. Report flow: end + block + report creation.
12. Skip flow: end + immediate requeue.
13. End flow: session ends for both with no auto-requeue.
14. Off-page match toast + open CTA behavior.
15. Nav badge + top pill status behavior.
16. Admin report queue: list, resolve, ban.
17. Regression: normal message requests and normal DMs unchanged.

## 10. Assumptions and Defaults
- Launch model: full release.
- Kill switch available to disable quickly.
- Scale target: up to 500 concurrent queue users.
- Moderation is report-driven in v1.
- In-app notifications only in v1.
- Indefinite retention for anonymous transcripts.
- Auto-follow is silent and idempotent.

## Appendix A: Q&A Log (All Questions and Answers)

| ID | Question | Answer | Status |
|---|---|---|---|
| Q-001 | How should anonymous chat convert into real DM? | Mutual opt-in | active |
| Q-002 | Who should be match-eligible by default? | User-selectable scope | active |
| Q-003 | What happens when one user leaves anon chat? | End session; ask to match again | active |
| Q-004 | Allowed message types in v1? | Text + images | active |
| Q-005 | Required v1 safety controls? | Report + block + end | active |
| Q-006 | On connect, what happens to anon transcript? | Carry into DM | active |
| Q-007 | What identity is shown pre-connect? | User-defined pseudonym, can be saved | active |
| Q-008 | Rematch policy? | Cooldown rematch | active |
| Q-009 | How should DM privacy interact with anon queue? | Asked for clarification | superseded by Q-010 |
| Q-010 | Final privacy model for anon queue? | Separate anon toggle | active |
| Q-011 | Pseudonym lifecycle? | Saved default alias | active |
| Q-012 | Block scope from anon flow? | Global block | active |
| Q-013 | Matching strategy within pool? | Random eligible | active |
| Q-014 | Refresh/reopen behavior? | Resume active state | active |
| Q-015 | Post-connect side effects? | Auto-follow both | active |
| Q-016 | On report, immediate behavior? | End + block + file report | active |
| Q-017 | Rollout strategy? | Full release | active |
| Q-018 | Plan doc path? | `docs/anon-chat-plan.md` | active |
| Q-019 | Target queue scale (6 months)? | Up to 500 | active |
| Q-020 | Automated moderation strictness? | Report-driven only | active |
| Q-021 | Auto-follow vs follow privacy? | Override on connect | active |
| Q-022 | Default scope behavior? | Last used | active |
| Q-023 | Session hard limits? | No hard limit | active |
| Q-024 | Waiting behavior? | Retry rounds | active |
| Q-025 | Retry round cadence? | 30 seconds | active |
| Q-026 | Connect request lifecycle? | Sticky until end | active |
| Q-027 | Admin handling surface for reports? | Dedicated admin queue | active |
| Q-028 | Queue presence outside Messages page? | App-wide persist | active |
| Q-029 | Skip action in active anon chat? | Yes, skip + requeue | active |
| Q-030 | Alias validation rules? | 3–24 chars + safe chars | active |
| Q-031 | Match found while off-page behavior? | In-app toast + open CTA | active |
| Q-032 | Global queue/session indicator? | Nav badge + top pill | active |
| Q-033 | Retention for non-promoted anon transcripts? | Indefinite | active |
| Q-034 | User entrypoint for feature? | Messages tab section | active |
| Q-035 | User-facing feature label? | Campus Match | active |
| Q-036 | Reveal data after connect? | Full profile identity | active |
| Q-037 | If connect is declined, behavior? | Reset both requests to `none`; retry allowed | active |
| Q-038 | Relationship-based eligibility filter? | Exclude existing DMs | active |
| Q-039 | Concurrent anon states per user? | Single active state | active |
| Q-040 | Where store “last used scope”? | Per account | active |
| Q-041 | Queue stale timeout offline? | 90 seconds | active |
| Q-042 | Match notification depth in v1? | In-app only | active |

## Appendix B: New Question Entry Template

| ID | Date | Phase | Question | Options Considered | Answer | Impacted Sections | Status |
|---|---|---|---|---|---|---|---|
| Q-XXX | YYYY-MM-DD | Phase N | ... | ... | ... | ... | active/superseded |
