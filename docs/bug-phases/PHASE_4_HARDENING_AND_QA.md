# Phase 4: Hardening and QA

## Goal

Lock in the fixes with tests, guardrails, and monitoring.

## Why This Phase Last

- After behavior is corrected, this phase prevents regressions and improves confidence for future changes.

## Implementation Steps

1. Add regression test suite mapping directly to each fixed bug class.
2. Remove or reduce broad `/* eslint-disable */` usage in high-risk UI files touched by these fixes.
3. Add lightweight telemetry/logging around moderation transition conflicts and validation rejects.
4. Add release checklist for these flows:
   - posts with links
   - follow/profile visibility
   - message request accept path
   - landmark moderation
5. Run full `lint`, `tsc`, and `build` gates before merge.

## Success Criteria

- Every fixed issue has at least one regression test.
- Lint suppressions are reduced in touched files, with targeted disables only if justified.
- Operational logs can distinguish invalid input, conflict, and auth/visibility failures.
- CI gates pass with no new TypeScript or build regressions.

## Suggested Verification

1. Run all automated checks in CI and locally.
2. Execute a short manual QA script covering all phase deliverables.
3. Tag this phase complete only after one clean staging pass.
