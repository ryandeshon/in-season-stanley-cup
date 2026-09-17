# Effects and original game assets — September 17, 2026

## Recommended renderer

[PixiJS 8](https://pixijs.com/8.x/guides/components/filters) is the best fit for a richer arena effects pass: use a transparent canvas over the existing HTML fighters, additive particles and textured sprites for fire/acid/orbs, then blur/glow and displacement for impact. Keep Vue responsible for score, ownership and the presentation state machine. Lazy-load the renderer, cap particle count/resolution on phones, stop it in hidden tabs, destroy it on unmount, and leave the readable static result when effects or reduced-motion settings disable animation.

The [PixiJS filters collection](https://pixijs.io/filters/docs/index.html) supplies additional effects. A transition library alone would smooth movement but would not supply convincing fire, electrical branching or liquid textures. This is a recommendation for the next effects pass; no new rendering dependency is included in this layout/story update.

## Located originals

- [MKWarehouse MKII text, fire and projectile sprites](https://www.mortalkombatwarehouse.com/mk2/props/#text).
- Visually verified [Finish Him PNG](https://www.mortalkombatwarehouse.com/mk2/props/text/0312.png), 287 × 40 pixels; adjacent 0313.png is Finish Her.
- [MKII sounds](https://www.mortalkombatwarehouse.com/mk2/sounds/) includes Shao Kahn announcements, hits, character sounds and music cues, with category downloads.
- [The Vault](https://leedberg.com/mk/vault/vault2.htm) lists a specifically named `finishim.wav` sample.

MKWarehouse displays a Creative Commons link and identifies Warner Bros. trademarks. This research does not establish that the site's license grants rights to redistribute the underlying game recordings/art. The assets are linked for review, not bundled or hotlinked in the app. Exact sound selection and usage rights remain to be resolved before integrating game media. The current app keeps sound opt-in and defaults it off.

## Design feedback applied

Remove the Season 3 home intro block, keep navigation in one dropdown, restore light/dark controls, use official NHL logos in Season 3 and put recognizable logos under each fighter. Season 2 keeps its historical artwork. Rebuild the prologue around the supplied local scroll demo: grey stone console, pinned scene, 60-second scrub, chapter selection, slow camera movement, playback/typewriter/full-text controls and reduced-motion support. Gameplay and real season data are unchanged.
