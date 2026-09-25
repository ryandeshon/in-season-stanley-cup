# Arcade sound cues

MP3 files supplied by the user in `sounds.zip` on September 25, 2026.

- `start`: Story Play/Replay from the beginning.
- `ryan-talk1–3`: random champion intro, only for Ryan; followed by `fight`.
- `fight`: game intro for every champion.
- Player `attack` clips: the scoring owner, followed by a random `hurt1–7`.
- `hurt-final`: the losing fighter during a fatality, after the winner’s attack. Supplied separately by the user.
- `select`: fighter matchup preview and draft player selection.
- `finish-him`, finishing attack/hurt, `fatality`, then shutout-only `flawless-victory`.
- `tick`: draft countdown seconds 10–4; `tick2`: seconds 3–1. No ticks while locked.

Sound unlocks on a user gesture, respects the shared mute setting, and stops when its view is hidden or unmounted. Final animations also respect reduced motion.
