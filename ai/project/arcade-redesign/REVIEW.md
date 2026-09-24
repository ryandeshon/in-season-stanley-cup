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

Each character now has a 2×2 expression atlas: Happy, Angry, Anguish and Sad.
The defeated portraits show bruises, small cuts and scuffed clothing or armor.
Hurt expressions start at impact, with opponent-specific effects layered above
the portrait. The original identity portraits remain as image-loading fallbacks.
Full-body animation and short action sequences are deferred for a separate
experiment. Current finishers use localized portrait effects rather than full
illustrated choreography. See PORTRAIT-PROMPTS.md for asset provenance.

Local portrait verification: 136 unit tests, 49 browser tests, the hosted-preview
test and production build passed. All four defeated portraits were captured and
visually reviewed. The portrait and story-pinning baseline was subsequently pushed and deployed
to Test after user approval; all four hosted portrait files were verified against
the local PNGs.

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

## Authorized Test deployment

Following review, the user requested hosting the interactive sample-data preview on Test. Enable `VUE_APP_HOSTED_ARCADE_PREVIEW=true` only for Test. The preview defaults to Season 3 independently of saved live-season preferences. Use the preview toolbar to change scores and owners; Reset restores sample state in this browser. These actions never update the database. Production remains unchanged. The hosted production bundle has an additional Cypress gate, alongside the full existing browser suite.

## Follow-up design notes

Home now starts at the faceoff. The dropdown contains all navigation links and light/dark mode; selecting a route closes it. Season 3 uses official NHL team marks, including larger logos under the portraits. The dark arena retains the dark-background logo variants in both app themes. The story matches the supplied prologue-v2 scroll preview with the stone console, pinned scroll progression, camera motion and optional typewriter playback. See EFFECTS-RESEARCH.md for the PixiJS recommendation and original Mortal Kombat media sources; those media files are not included in this update.

## PixiJS attack review

Use Test's sample controls to choose each owner, then add a goal: Ryan emits fire and embers, Cooper sends branching lightning, Terry throws acid droplets, and Boz sends an orb with an expanding impact ring. Try goals from both sides. Shutout final and Replay fatality reuse the winning fighter's effect. Turn Effects off during an attack to clear the layer; reduced motion preserves a static result. The effects use procedural graphics, not original game recordings or sprites.

## Champion realms and story refinement (local review)

Story illustrations keep a fixed height while narration types. The text panel
grows within its available space, scrolls on small screens, and follows the
latest typed line. One interactive slider above playback controls replaces the
duplicate progress indicators. Story position is screen-reader-only; the menu
link is Story. The existing navigation offset and full scroll duration remain.

The live defending owner selects the arena; a confirmed winner takes over the
realm at the final result. Ryan keeps The Black Rink, Cooper has Thunderkeep Ice,
Boz has The Spotlight Pit, and Terry has The Venom Vault. An unknown owner uses
The Portal Rink. These four new backgrounds are original generated artwork; see
ARENA-PROMPTS.md for saved filenames, prompts and reference sites. Defeated
portraits retain color at reduced brightness. Victory headings show the owner
without a repeated team abbreviation.

Validation: 141 unit tests; 49 browser cases (46 full-suite passes plus the three
updated story checks on targeted rerun); hosted-preview and champion-realm
checks; production build and lint. Story screenshots reviewed at 1280×720 and
320×640, and champion arena screenshots reviewed. These newer changes remain
local for review. The deployed Test baseline does not include them yet.

## Identity and dossier review (local)

New original SVG icons replace the Season 3 header numeral, standings champion
crown, browser favicon and championship trophy. The wordmark uses outlined
pixel lettering without a font dependency. Character pages now combine portrait,
lore, known past honors and defense statistics in one card. Click anywhere on
the card, Enter or Space cycles Happy → Angry → Anguish → Sad. Changing the
character resets to Happy. Ryan and Cooper's historical honors are presentation
metadata based on confirmed prior winners; season/database counters are unchanged.

Validated 143 unit tests, 51 browser cases (50 in the full run plus the corrected
legacy dossier selector on targeted rerun) and two hosted-preview cases. Build
and lint pass. Desktop/mobile dossier screenshots and the icon family were
visually reviewed. These updates remain local.

## Approved Test update

The user approved pushing the completed arena, story, identity, dossier and
spacing changes to Test. This supersedes the local-only review notes above.
Test remains an interactive sample-data preview; production and stored season
statistics are unchanged. Fighter cards are capped at 250px, frame padding is
24px (12px on phones), and shot counts are centered below team logos.
