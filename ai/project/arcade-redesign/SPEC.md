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

The story stage must pin 10px below the actual navigation bottom, never use a negative sticky offset to fit controls. Its containing scroll track must include the console height plus the full 2400px story progression so it releases only after the final scene. Keep the image within the viewport on desktop and phone sizes. Follow-up changes stay local until the user deploys Test.

## Expressive portrait implementation

Use four custom expression atlases (one 2×2 sheet per owner) with Happy, Angry, Anguish and Sad quadrants. The final Sad state has visible bruises, small cuts and scuffed clothing/armor. Resolve emotions from confirmed score/result and transient impact, keeping score updates immediate. During travel preserve the prior expression until contact; only the receiver recoils, with a response determined by the incoming attack. Keep layered PixiJS effects independent of portrait art, preserve fallbacks, reduced motion, disabled effects and historical seasons. Full-body action sprites are deferred. All changes remain local.

## Story and arena review follow-up

Push the verified portrait/story-pinning baseline and deploy it to Test if absent. Then keep this next review local: fixed-height story artwork during typing, readable scrolling narration, one interactive progress slider above playback controls with a screen-reader-only label, and a concise Story navigation link. Create four original rink backgrounds: Cooper/Thunderkeep Ice, Boz/The Spotlight Pit, Terry/The Venom Vault, and The Portal Rink for unassigned champions. Ryan retains The Black Rink. Use the defending champion's owner for the arena during a game; change to the confirmed winner's realm on final results. Dim defeated portraits while retaining color, and display only the winner's name in the victory heading.

Black Rink v2 matches the new arenas’ 1536×1024 canvas and wide rink geometry while retaining black ice, red banners and the throne-room setting. The original is retained as source art.

Fighter cards are capped at 250px and centered in their grid columns, shrinking on narrow screens. PixiJS reads the actual portrait bounds for launch and impact points.

## Identity icons and unified dossiers
Create original scalable SVG artwork for the app logo, favicon, current-champion badge and silver championship Cup. Use the Cup in place of III in the Season 3 header and for historical championship honors. Preserve archived season artwork. Combine Season 3 profile portrait, lore, honors and defense stats into one card that cycles Happy → Angry → Anguish → Sad with click, Enter or Space and resets when the player changes. Historical champion honors for Cooper and Ryan reflect the user-confirmed previous winners; no database records are modified.
