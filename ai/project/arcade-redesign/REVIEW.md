# Phase 4 review: The Black Rink

Issue #78. This implementation uses the approved v3 handoff and the companion
“Plan Mortal Kombat visual refactor” conversation. The complete asset bundle was
found and imported with its font license; the approved three-scene copy is intact.

## Try it locally

From this worktree, run `yarn preview:arcade` and open http://localhost:8090.
The conspicuous review toolbar controls an in-memory fixture API on port 8091.
There is no database client, production proxy or fallback. Unimplemented API routes
return 404 and normal mutation endpoints return 405. Restart/reset discards edits.
The preview intentionally uses sample Season 3 rosters and scores, not migrated
production records. The toolbar is gated to development plus its explicit flag.

- Try BOS/TOR goals, intermission, final and shutout final. Sound starts off.
- Change the left/right owner to exercise fire, lightning, acid and blue orb.
  Owner changes reload to establish a new animation baseline. A mirror pairing
  retains both team labels and suppresses the finisher.
- Select either fighter to preview their possible next defense. This does not
  save a prediction. Follow the name to the dossier and the game link to stats.
- Visit standings and the story; try timed playback, pause, chapters, scroll and skip.
- Use the navigation menu to inspect archived season styling. The preview's
  historical data is illustrative only; production history is unchanged.
- Try a narrow phone viewport and OS reduced motion. The real score and result
  stay visible independently of effects.

## Delivered and intentionally progressive

The Season 3 shell, readable scoreboard, portrait faceoff, attack/impact layers,
final result classification, deduplicated playback, static winner/loser states,
page styling, dossier copy and optional prologue are implemented. Existing draft
permissions/turn logic, season storage and statistics remain authoritative.

The four identity portraits are the shipped fallback. The manifest explicitly
marks them as fallback artwork for all five pose keys. The handoff's reaction
and full-body sprite sheets are concept studies, not transparent production
atlases. Separate reaction/pose artwork and frame-animated full-body finishers
remain an art follow-up. Current finishers are short localized CSS effects on
portraits; they do not claim to implement the full illustrated choreography.
The supplied PNGs are retained at original quality for this review.

## Review boundary

No production migration, activation, upload, deployment or merge is performed.
This phase stops at the draft PR, screenshots and local user testing. Season 1/2
use their existing themes; Season 3 is selected only when offered by the season
catalog. The story is available without forcing an intro or activating a season.

## Validation

Local lint, production build, 130 unit tests, 36 Cypress tests and 25 backend tests
pass. All 12 cross-character pairings are exercised from both attack directions.
The persistence suite requires DynamoDB Local; the repository CI provides that
service. The security scanner reports the same three baseline documentation/
asset-policy matches; the changed scope has no matches. Existing production asset
size warnings remain. The patch changeset resolves to version 2.4.2.
