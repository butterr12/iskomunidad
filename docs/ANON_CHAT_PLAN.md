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
| 1 | Data Model and Migrations | done | Claude | 2026-02-19 |
| 2 | Backend Core Logic | not started | TBD | TBD |
| 3 | Realtime and Persistence | not started | TBD | TBD |
| 4 | User UX (Messages + Settings) | not started | TBD | TBD |
| 5 | Admin Moderation | not started | TBD | TBD |
| 6 | Hardening and QA | not started | TBD | TBD |

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
- Decline behavior: retry allowed
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

### Done When
- Regression suite and manual scenario checks pass.
- No unresolved P0/P1 issues for Campus Match launch.

## 8. Public API / Type Contract (Canonical)
```ts
type MatchScope = "same-campus" | "all-campuses";
type QueueStatus = "idle" | "waiting" | "matched";
type AnonSessionStatus = "active" | "ended" | "promoted";
type ConnectState = "none" | "pending_me" | "pending_them" | "mutual";

type CampusMatchPreferences = {
  allowAnonQueue: boolean;
  defaultAlias: string | null;
  lastScope: MatchScope;
};

type CampusMatchState = {
  status: "idle" | "waiting" | "in_session";
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
| Q-037 | If connect is declined, behavior? | Retry allowed | active |
| Q-038 | Relationship-based eligibility filter? | Exclude existing DMs | active |
| Q-039 | Concurrent anon states per user? | Single active state | active |
| Q-040 | Where store “last used scope”? | Per account | active |
| Q-041 | Queue stale timeout offline? | 90 seconds | active |
| Q-042 | Match notification depth in v1? | In-app only | active |

## Appendix B: New Question Entry Template

| ID | Date | Phase | Question | Options Considered | Answer | Impacted Sections | Status |
|---|---|---|---|---|---|---|---|
| Q-XXX | YYYY-MM-DD | Phase N | ... | ... | ... | ... | active/superseded |