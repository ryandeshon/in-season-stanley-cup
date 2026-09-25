# Test draft rehearsal

Open https://test.inseasoncup.com/draft/admin?draftTest=1, enter the separate
Test admin token, and open a player link in a second window or on another device.
Enter that player's Test access code. Start the draft from Admin and make a pick
from the player whose turn is shown. Admin also provides advance, undo, lock,
autopick, and reset controls.

The toolbar defaults to **WebSocket only (pause polling)**. Both windows should
show Connected. A pick or admin action should increment Events received in the
other window and update its draft. Send test event checks transport without
changing picks. Disconnect/Reconnect exercises reconnect refresh; unchecking
WebSocket only restores the five-second polling fallback. Opening a new page or
reconnecting always reads current state, even when polling is paused.

The explicit `draftTest=1` mode uses separate API Gateway HTTP and WebSocket APIs,
six separate DynamoDB tables, and IAM roles restricted to those Test resources.
It runs the same HTTP draft handler and browser draft pages as production. The
Test socket uses the existing `default` message / `draftUpdate` protocol, sending
only invalidations; recipients fetch authoritative state from the Test API.
Test access codes are private and have no production authority. No tokens are
included in the frontend build. This verifies real Test delivery; it does not
certify the separate production WebSocket infrastructure.

Game scenarios remain browser-local. Back to game scenarios exits draft mode.
Draft mode is shared across all Test users; resetting it clears everyone's Test
picks. Production and historical season records are unaffected.

## Infrastructure

`infra/test-draft/template.py` generates the CloudFormation template for stack
`inseason-test-draft`. Supply AdminToken and PlayerTokens as private NoEcho
parameters, plus the existing SDK v2 layer ARN as SdkLayer. The stack initially
creates an HTTP placeholder. Run `npm run package:lambdas`, then upload
`http-api.deploy.zip` to the stack's HttpFunction output after provisioning.
Seed Catalog with defaultSeason season3 and a season3 preseason record with
writersEnabled true and revision 1. Seed four empty Player rows and matching
Lifetime rows; the handler initializes draft state. Never copy production
credentials or configure the stack with production table names.

Set only the Amplify **test branch** variables VUE_APP_TEST_DRAFT_API_BASE and
VUE_APP_TEST_DRAFT_SOCKET_URL from HttpUrl and SocketUrl outputs. Keep
VUE_APP_HOSTED_ARCADE_PREVIEW=true. Missing Test endpoint settings fail closed.

The stack has no scheduled scoring and incurs normal API/Lambda/DynamoDB usage
charges. Its sample data is disposable. Delete only `inseason-test-draft` when
retiring this facility, and remove the two Test branch variables.
