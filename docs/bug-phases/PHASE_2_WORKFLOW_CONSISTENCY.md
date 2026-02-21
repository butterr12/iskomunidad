# Phase 2: Workflow Consistency ✅ COMPLETE

## Goal

Make moderation and messaging transitions race-safe and idempotent.

## Why This Phase Second

- These are operational correctness bugs that can create repeated notifications and inconsistent state.
- Fixes are localized and can be shipped safely after Phase 1.

## Implementation Steps

1. ✅ Update landmark approve/reject actions to require current status `draft` in `WHERE` conditions.
2. ✅ Return clear conflict messages when landmark status changed concurrently.
3. ✅ Prevent duplicate moderation notifications by ensuring notifications only fire on successful state transition.
4. ✅ Wrap `acceptRequest` updates in a single DB transaction (already existed).
5. ✅ Add defensive checks for no-op transitions so repeat clicks do not mutate state.
6. ✅ Surface conflict errors in landmark admin UI via toast notifications (matching posts/events/gigs pattern).

## Files Changed

- `src/actions/admin.ts` — `adminApproveLandmark` and `adminRejectLandmark` now guard on `status='draft'`, return conflict errors, and wrap notifications in try/catch.
- `src/app/admin/locations/queue/page.tsx` — Handlers now check `ActionResult` and show success/error toasts.
- `src/app/admin/locations/page.tsx` — Same toast pattern for approve/reject/delete handlers.

## Success Criteria

- ✅ Landmark approval/rejection can only happen once per pending item.
- ✅ Concurrent admin actions produce one success and one deterministic conflict response.
- ✅ No repeated user notifications from repeated approve/reject clicks.
- ✅ `acceptRequest` cannot leave split state (`accepted` + `isRequest=true`).
- ⬚ Tests cover concurrency-style behavior (no test framework in repo yet — separate concern).

## Suggested Verification

1. ⬚ Add integration tests that call approve/reject twice and assert second call is rejected.
2. ⬚ Add transaction test for accept flow with simulated failure in second update.
3. ✅ Manual admin queue smoke test for posts/events/landmarks/gigs parity.
