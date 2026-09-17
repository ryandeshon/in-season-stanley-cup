# Arcade redesign backlog

- DONE: read v3 guide and companion conversation; locate complete assets bundle.
- DONE: explicit Season 3 theme, stone frames, licensed local font, shared shell.
- DONE: portrait faceoff, all four reusable attack/impact effects and static fallback.
- DONE: conservative results, final playback latch, corrections, motion/audio controls.
- DONE: standings/profile/game/draft styling and optional three-scene prologue.
- DONE: isolated in-memory review preview and desktop/mobile visual inspection.
- DONE: local lint/build, 130 unit, 36 Cypress and 25 backend tests; patch changeset.
- REVIEW: draft PR and CI database integration (DynamoDB Local unavailable on host).
- ART FOLLOW-UP: aligned emotion/pose artwork and full-body transparent animation
  atlases. Supplied concept sheets are not production sprites. Review uses approved
  portraits and localized CSS finishers as the guide's progressive fallback.

- [x] Add opt-in hosted sample-data mode with browser-local persistence and Reset.
- [x] Add production-build Cypress coverage for sample goals, owner reloads, story navigation and rejected writes.

- [x] Apply review notes: remove home intro, consolidate menu, restore light/dark, use official Season 3 team logos and add fighter-side logos.
- [x] Port the prologue-v2 stone console and scroll/timed behavior; validate chapter, pause, scrub and skip controls.
- [x] Research a richer effects renderer and locate original Finish Him art and game sound sources (EFFECTS-RESEARCH.md).
- [ ] Implement the recommended PixiJS effects pass and resolve original-game media selection/usage before integrating those assets.
