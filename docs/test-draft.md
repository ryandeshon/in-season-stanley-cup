# Test draft practice

Open https://test.inseasoncup.com/draft/admin. No admin token or player codes are
needed. Use Start Draft, then open the player links to choose teams. Admin also
provides advance, undo, lock/unlock, countdown auto-picks, and Reset to replay.
The locked order is Terry → Boz → Cooper → Ryan, repeated for all eight rounds.
Keep Admin open for countdown auto-picks.

All Test draft routes (including old `?draftTest=1` links) use browser-local
storage. Picks survive reloads. Reset clears this browser's practice rosters and
picks; clearing site data also removes them. Tabs on the same origin and browser
profile share the draft through storage events. Other browsers/devices have
independent drafts. No draft API requests, WebSocket connections, or database
writes occur in this mode. This exercises the draft UI and local rules; it does
not validate the real multiplayer WebSocket server or production authorization.

The toolbar shows local sync status and received events. Disconnect/Reconnect
lets you test resynchronization; disabling Live updates only enables polling.
Web Locks serialize writes across tabs, and version checks reject stale picks.
If browser storage or Web Locks is unavailable, practice fails closed without
falling back to a backend. Use a current browser on HTTPS or localhost.

Back to game scenarios returns to the existing browser-local game previews.
Production and historical seasons are unaffected. This feature is enabled only
by `VUE_APP_HOSTED_ARCADE_PREVIEW=true`, on draft routes.

## Existing Test backend

The previously provisioned `inseason-test-draft` stack remains untouched, but
this Test frontend no longer uses it. `VUE_APP_TEST_DRAFT_API_BASE` and
`VUE_APP_TEST_DRAFT_SOCKET_URL` are no longer read. The infrastructure template
remains in `infra/test-draft` for future real transport testing; local sync must
not be reported as a real WebSocket test.
