# SPEC: player-profile-trends

## Summary
Add a trend snapshot panel on player profile pages so users can quickly evaluate recent form and matchup performance without manually scanning all game history rows.

## Problem
- Player profile currently shows raw history and per-team records but no compact trend analytics.
- Users cannot quickly answer: “How has this player performed lately?” or “Who do they struggle against?”.
- Existing mirror-match handling exists in row rendering but trend calculations are not defined.

## Goals
- Add last-10 form summary (`W-L-M` + win percentage).
- Add strongest owned team and weakest matchup split with deterministic tie-breaking.
- Keep logic pure/testable and resilient to missing or malformed records.

## Non-Goals
- No backend/API changes.
- No new persistence or analytics storage.
- No homepage/standings trend panel work.

## Constraints
- Frontend-only change in existing Vue 3 + Vuetify app.
- Must preserve current loading/error/empty profile states.
- Mirror matches must be handled explicitly and not break calculations.

## Technical Design
- New utility: `src/utilities/playerProfileTrends.js`
  - Normalize team abbreviations (including legacy `WIN -> WPG`).
  - Sort profile games by recency (`id` desc; timestamp fallback when needed).
  - Classify games as `Win`, `Loss`, `Mirror`, `Unknown`.
  - Compute trend outputs:
    - last-10 form
    - best-performing team
    - weakest matchup
  - Build filtered/sorted profile history list.
- Integrate in `src/pages/PlayerProfile.vue`
  - Use shared utility for history filtering and trend computations.
  - Render `Trend Snapshot` card between player header and history table.
  - Add `data-test` hooks for trend rows.
- Tests:
  - `tests/unit/playerProfileTrends.spec.js` for sort/classification/tie-breakers/empty cases.

## Risks and Mitigations
- Risk: trend numbers diverge from displayed history filtering.
  - Mitigation: both history and trends use the same utility-driven filtered game list.
- Risk: legacy team abbreviations cause missed matches.
  - Mitigation: normalize abbreviations in utility (`WIN -> WPG`).

## Acceptance Criteria
1. Given a player profile with tracked games, trend snapshot is visible with last-10 form, best team, and weakest matchup.
2. Given mirror-only or sparse data, trend snapshot renders graceful `N/A` behavior.
3. Given ties in win percentage, deterministic tie-break rules produce stable winners.
4. Existing profile history pagination and game table continue to work.

## Verification Plan
- Run unit tests: `npm run test:unit`.
- Run lint: `npm run lint`.
- Manually verify profile view shows trend panel in:
  - populated profile
  - no-game profile
  - error state

## Rollback Plan
- Revert utility import and trend panel additions in `PlayerProfile.vue`.
- Remove `playerProfileTrends` utility and its unit test file.
