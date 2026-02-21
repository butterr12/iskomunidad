# Phase 3: Validation and Onboarding Correctness

## Goal

Align server validation with UI assumptions and fix onboarding logic drift.

## Why This Phase Third

- It reduces recurring correctness bugs and broken edge behavior.
- It is lower immediate risk than Phases 1 and 2 but important for long-term stability.

## Implementation Steps

1. Convert post flair validation to strict enum (server-side).
2. Convert gig category validation to strict enum (server-side).
3. Add migration/data-check task to detect out-of-spec existing values and remediate.
4. Fix consent/onboarding gate logic:
   - clarify and enforce whether `displayUsername` is mandatory
   - remove local completed-state bypass risk if server still reports unmet requirements
5. Harden username availability check error handling so network failures degrade gracefully.
6. Add affected-row checks to admin role/ban/delete style mutations where success currently may be misleading.

## Success Criteria

- Invalid flair/category inputs are rejected at API boundary.
- All existing records satisfy enum constraints or are migrated safely.
- Onboarding no longer bypasses required steps due to local-only completion state.
- Username availability checks no longer produce unhandled failures.
- Admin mutation responses distinguish "not found" from successful update.

## Suggested Verification

1. Add schema validation tests for flair/category.
2. Add an onboarding flow test covering refresh/reload mid-step.
3. Add tests for admin mutations to assert not-found behavior.
