# Phase 4 arcade redesign

Issue #78. Authorized after #76 merge, using the supplied Arcade Redesign Guide v3
as design guidance. Redesign is Phase 4; preserve Phase 3 storage contracts.

Implement an explicit Season 3 theme: stone/beveled frames, charcoal and ivory,
green selection, gold victories, legible real HTML scores/stats and accessible
controls. Keep Seasons 1/2 identities and assets. Use the four approved embedded
portraits and Black Rink artwork initially; concept sheets are not production
atlases. The companion bundle supplies the stone texture, licensed font and three story scenes; production pose atlases remain a documented art follow-up.

Deliver a character faceoff and shared surfaces across home, standings, profile,
game, draft and season champion. Separate presentation from game authority. Add
conservative flawless classification, event deduplication, optional local effects,
reduced-motion support and sound off by default. Preserve static fallbacks and
existing behavioral hooks. Never auto-play old finals or mirror-match fatalities.

Validate current unit/backend/browser gates plus new result/animation cases and
responsive screenshots. Supply an isolated local fixture preview for user testing.
No production writes, migration, deployment, merge or baseline acceptance. Stop
for review after the implementation and screenshots.

## Hosted Test preview

The Test branch may opt into `VUE_APP_HOSTED_ARCADE_PREVIEW=true`. A same-origin service worker serves sample API responses; API clients and NHL requests use only that worker, sockets and analytics are disabled. Unknown requests fail closed. Sample scores and owner choices persist in browser Cache Storage; Reset restores the fixture. This mode requires HTTPS (or localhost) and service workers. Real season records are not read or changed.

The follow-up review removes the Season 3 homepage intro and duplicate navigation, restores light/dark selection, and replaces Season 3 team artwork with official NHL logos. Story presentation follows the supplied prologue-v2 scroll demo, with one pinned scene driven by scroll or a 60-second timeline; pause, full text, scrub, chapters and skip remain available.

## PixiJS attack upgrade

Replace the CSS goal effects with a lazy-loaded transparent PixiJS 8 overlay: ember fire, branching electricity, ballistic acid droplets and an energy orb/shockwave. Keep the existing score-event tracker and phase timings authoritative. Bound particle count and pixel density, stop rendering when idle/hidden/disabled, discard stale asynchronous initialization and destroy GPU resources on unmount. Preserve a static CSS fallback for reduced motion or unavailable WebGL. Verify all four attacks in both directions plus cancellation and browser rendering before review.
