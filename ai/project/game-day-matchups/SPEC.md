# SPEC: game-day-matchups

## Summary
Add a homepage game-day interaction where users can click either the Champion or Challenger card to preview who they would defend against next if that side wins tonight.

## Problem
- On cup defense days, users can see the current matchup but cannot preview what tomorrow's title defense would look like under each outcome.
- This makes it harder to understand near-term bracket implications before the game is final.

## Goals
- Make Champion and Challenger cards selectable on game day.
- Show conditional next-day matchups based on the selected winner.
- Keep existing off-day and game details behavior intact.

## Non-Goals
- Changing backend contracts or adding new endpoints.
- Changing season-over behavior.
- Altering existing off-day upcoming matchup logic.

## Constraints
- Use existing frontend API integrations (`getSchedule`, current champion/player mapping).
- Keep behavior deterministic in Cypress via fixtures/stubs.
- Preserve current homepage states outside the new game-day conditional panel.

## Technical Design
- Homepage game-day card interaction:
  - Add selected winner state (`champion` or `challenger`) in `HomePage.vue`.
  - Make both game-day `PlayerCard` components clickable and route selection through `card-click` events.
- Conditional matchup panel:
  - Render only after a side is selected.
  - Fetch next-day schedule based on current game date (`todaysGame.startTimeUTC + 1 day`).
  - Filter to games involving selected winner team.
  - Show date/time, matchup teams, and opponent owner mapping.
  - Show explicit empty-state when no next-day defense exists.
- Regression protection:
  - Keep off-day "Possible Upcoming Match-ups" table unchanged.
  - Keep "View Game Details" link and standard game-day header behavior unchanged.

## Risks and Mitigations
- Risk: conditional schedule filtering fails for stale or missing date data.
  - Mitigation: fallback to `DateTime.now()` and fail closed to empty list.
- Risk: unavailable team-owner mapping for some opponent teams.
  - Mitigation: render `Unknown` owner label without breaking table.

## Acceptance Criteria
1. Given a cup defense day with Champion vs Challenger visible, when no side is selected, then no conditional matchup list is shown.
2. Given a cup defense day, when the user clicks Champion, then a conditional list renders for Champion-win outcomes using that team's next-day schedule defenses.
3. Given a cup defense day, when the user clicks Challenger, then the list updates to Challenger-win outcomes using that team's next-day schedule defenses.
4. Given conditional results are shown, each row includes matchup date/time, both teams, and mapped player owner for the non-winning side.
5. Given there are no qualifying next-day defenses for the selected side, then the UI shows a clear no-matchups empty state.
6. Given any existing non-game-day/off-day flow, then current "Possible Upcoming Match-ups" behavior remains unchanged.

## Verification Plan
- Run Cypress homepage spec with fixtures:
  - Champion click renders expected conditional row data.
  - Challenger click switches conditional row data.
  - Empty-state scenario renders on game day with no next-day options.
  - Off-day regression remains unchanged.

## Rollback Plan
- Revert `src/pages/HomePage.vue` conditional selection and rendering changes.
- Revert Cypress fixture/test updates tied to this feature.
- Keep project planning docs for future reimplementation.
