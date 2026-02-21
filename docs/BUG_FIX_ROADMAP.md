# Bug Fix Roadmap (Phased)

This roadmap breaks the bug review into small, low-risk implementation phases.

## Prioritization Approach

1. Fix exploitable security and account-status bugs first.
2. Fix state consistency and moderation integrity next.
3. Fix validation and onboarding correctness after core safety is stable.
4. Finish with hardening, tests, and observability.

## Why This Ordering

- Phase 1 removes the highest-risk user-facing/security issues.
- Phase 2 prevents broken operational behavior and data drift during normal usage.
- Phase 3 reduces long-tail correctness and UX regressions.
- Phase 4 makes the fixes durable and safer to maintain.

## Phase List

1. `docs/bug-phases/PHASE_1_SECURITY_GUARDS.md`
2. `docs/bug-phases/PHASE_2_WORKFLOW_CONSISTENCY.md`
3. `docs/bug-phases/PHASE_3_VALIDATION_AND_ONBOARDING.md`
4. `docs/bug-phases/PHASE_4_HARDENING_AND_QA.md`

## Global Success Criteria

- No stored `javascript:`/non-web links can be created or rendered as actionable links.
- Inactive users cannot be followed, messaged, or resolved via public profile actions.
- Moderation and messaging transitions are atomic and idempotent.
- Validation is strict enough that UI assumptions hold for all persisted records.
- A regression test exists for every bug class addressed in this roadmap.
