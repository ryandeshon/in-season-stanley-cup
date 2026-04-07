# SPEC: player-profile-head-to-head-avatar-records

## Summary
Add a new Head-to-Head section to player profile pages that shows each opponent with a smaller avatar and the current profile player's win-loss record against that opponent.

## Release Target
- Planned release label: `release/2.2.0`
- Expected SemVer bump: `minor`

## Problem
- Player profiles currently show trend summaries, game history, and per-team records, but not direct player-vs-player records.
- Users cannot quickly answer "how does this player perform against each other player?".

## Goals
- Add a Head-to-Head section above Team Records on `PlayerProfile`.
- Show all other players alphabetically with avatar + `W-L` record.
- Use avatar emotion mapping based on matchup result: `Angry` (profile player leads), `Happy` (opponent leads), `Sad` (tie or 0-0).

## Non-Goals
- No backend, schema, or API contract changes.
- No changes to standings/home page behavior.

## Constraints
- Compute records from existing game record fields (`wTeam`, `lTeam`) and current team ownership only.
- Mirror/ambiguous ownership matches must not affect head-to-head totals.
- Keep existing loading/error/empty profile states stable.

## Technical Design
- Extend player profile data loading to include full players list (for opponent roster and current ownership map).
- Add pure utility logic in `src/utilities/playerProfileTrends.js` to derive head-to-head summaries.
- Render a new table/card section in `src/pages/PlayerProfile.vue` above Team Records.
- Add unit coverage for aggregation logic and component coverage for rendering/placement.
- Add Cypress coverage for the new user-facing profile section.

## Risks and Mitigations
- Risk: ownership inference mismatch if teams are missing or malformed.
  - Mitigation: normalize team abbreviations and skip unknown/ambiguous records.
- Risk: regressions in existing profile sections.
  - Mitigation: extend existing unit tests and keep section additive.

## Acceptance Criteria
1. Given a player profile, when data loads, then a Head-to-Head section appears above Team Records.
2. Given any opponent, when the profile player leads/trails/ties, then avatar uses Angry/Happy/Sad respectively.
3. Given no matchup games, when opponents render, then each still appears with `0-0` and `Sad`.
4. Given mixed game records, when aggregation runs, then mirror/unknown games are excluded.

## Verification Plan
- Run unit tests for profile utility/component logic.
- Run Cypress spec covering player profile head-to-head rendering.
- Validate issue/PR linkage and release metadata.

## Rollback Plan
- Revert the feature branch/PR.
- No data migration or backend rollback is required.
