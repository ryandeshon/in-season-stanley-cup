# Arcade redesign backlog

- DONE: read v3 guide and companion conversation; locate complete assets bundle.
- DONE: explicit Season 3 theme, stone frames, licensed local font, shared shell.
- DONE: portrait faceoff, all four reusable attack/impact effects and static fallback.
- DONE: conservative results, final playback latch, corrections, motion/audio controls.
- DONE: standings/profile/game/draft styling and optional three-scene prologue.
- DONE: isolated in-memory review preview and desktop/mobile visual inspection.
- DONE: local lint/build, 130 unit, 36 Cypress and 25 backend tests; patch changeset.
- REVIEW: draft PR and CI database integration (DynamoDB Local unavailable on host).
- DEFERRED: full-body animation atlases and short action sequences, for a separate
  experiment. Custom four-state expression atlases are implemented locally.

- [x] Add opt-in hosted sample-data mode with browser-local persistence and Reset.
- [x] Add production-build Cypress coverage for sample goals, owner reloads, story navigation and rejected writes.

- [x] Apply review notes: remove home intro, consolidate menu, restore light/dark, use official Season 3 team logos and add fighter-side logos.
- [x] Port the prologue-v2 stone console and scroll/timed behavior; validate chapter, pause, scrub and skip controls.
- [x] Research a richer effects renderer and locate original Finish Him art and game sound sources (EFFECTS-RESEARCH.md).
- [ ] Resolve original-game media selection/usage before integrating those assets.

## PixiJS follow-up
- [x] Implement bounded particle renderer and lifecycle integration.
- [x] Verify four attacks, cancellation, fallback and mobile rendering.
- [x] Capture effects and prepare the validated Test build for review.

- [x] Pin the story below navigation until progression completes; verify desktop, phone and 320px layouts. Keep this follow-up local for user deployment.

## Custom expressive portraits
- [x] Generate and inspect four equal-quadrant expression atlases, including visibly damaged defeated states.
- [x] Integrate Happy, Angry, Anguish and Sad with layered attack-specific recoil and image fallbacks.
- [x] Verify every pairing's impact timing and final-expression assignment in unit tests.
- [x] Review browser screenshots and production build; keep all changes local.

## Story and arena review follow-up
- [x] Push the verified portrait/story-pinning baseline; trigger Test deployment.
- [x] Fix story image sizing, narration visibility and the single scrubber.
- [x] Generate four original arenas and bind their name/background to champion ownership.
- [x] Dim defeated portraits and simplify the victory heading.
- [x] Verify Test deployment, local regressions and desktop/mobile screenshots.

- [x] Reshape The Black Rink to match the new rink dimensions and perspective; preserve original source art.

- [x] Cap fighters at 250px, center each in its arena column and verify responsive attack anchoring.

## Identity icons and unified dossiers
- [x] Create and integrate SVG logo, favicon, champion badge and Cup.
- [x] Merge profile dossier and card with accessible four-expression cycling.
- [x] Validate character navigation, trophy display, icons and responsive screenshots.
