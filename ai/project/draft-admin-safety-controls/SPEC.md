# SPEC: draft-admin-safety-controls

## Summary
Add operational safety controls to the draft flow so admins can pause picks, undo mistakes safely, and configure an auto-pick countdown that participants can see in real time.

## Problem
- Admins cannot currently pause the draft while investigating issues.
- Undoing a mistaken pick requires manual data correction.
- There is no configurable countdown signal for auto-pick pacing.
- Current pick flow splits player update and draft-state update, increasing risk of inconsistent state on failures.

## Goals
- Deliver issue `#26` with lock/unlock, undo-last-pick, and auto-pick countdown controls.
- Enforce key pick/undo validations in backend endpoints.
- Keep participant and admin UIs synchronized with clear status indicators.

## Non-Goals
- Full authorization redesign for admin-only role enforcement.
- Scheduler-based server-side auto-pick execution when no admin UI is open.

## Constraints
- Preserve existing season-aware API query behavior.
- Keep draft realtime updates compatible with current socket payload expectations.
- Maintain optimistic concurrency (`version`) conflict handling.

## Technical Design
- Backend (`lambdas/http-api/index.js`):
  - Extend draft state shape with:
    - `isLocked`
    - `autoPickEnabled`
    - `autoPickSeconds`
    - `autoPickDeadlineAt`
    - `pickHistory`
  - Add `POST /draft/pick` to apply validated pick operations and record history.
  - Add `POST /draft/undo-last-pick` to rollback the latest recorded pick.
  - Enforce lock validation on pick attempts.
- Frontend:
  - `src/pages/DraftAdminPage.vue`:
    - Add lock/unlock control.
    - Add undo-last-pick action.
    - Add auto-pick enable + seconds control with countdown display.
  - `src/pages/DraftPage.vue`:
    - Show lock status and countdown for participants.
    - Use server-validated pick endpoint.
  - `src/services/dynamodbService.js`:
    - Add draft pick and undo API helpers.
- Tests:
  - `tests/unit/httpApi.spec.js` for endpoint contracts, validation, and conflicts.
  - `cypress/e2e/draft.cy.js` + draft fixtures/commands for UI behavior.

## Risks and Mitigations
- Risk: multiple admin sessions can race auto-pick actions.
  - Mitigation: keep version checks and conflict refresh behavior.
- Risk: undo could fail if history is missing/corrupt.
  - Mitigation: explicit server-side validation and clear API errors.
- Risk: countdown confusion if draft is locked.
  - Mitigation: suppress auto-pick actions while locked and show lock status in UI.

## Acceptance Criteria
1. Admin can lock/unlock draft state from UI and picks are blocked while locked.
2. Undo-last-pick reverts both the player team assignment and draft state pointer/available teams consistently.
3. Auto-pick countdown is configurable in admin UI and visible to participants.

## Verification Plan
- `npm run test:unit`
- `npm run lint`
- `npm run test:e2e` (or targeted draft spec run)
- Manual verification on `/draft/admin` and `/draft/:name` with lock + undo + countdown flows.

## Rollback Plan
- Revert feature branch commits related to #26.
- Redeploy prior Lambda/frontend artifacts.
- If needed, clear new draft state fields by resetting draft state to defaults through admin reset flow.
