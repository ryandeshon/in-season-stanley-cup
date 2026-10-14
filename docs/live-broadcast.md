# Live game broadcasts

`lambdas/live-broadcast` publishes a `liveGameUpdate` every minute to connected viewers. It reads the default season from the canonical catalog, requires an active season, and reads that season's current cup game. It never writes game or season data. It paginates connections and removes only connections that API Gateway identifies as gone (410). A failed send to another connection is reported as a Lambda error.

The browser keeps its stale-feed polling fallback. Goal attack/hurt audio requires an enabled, unlocked sound control and a visible homepage; reconnecting does not replay old goals.

Package with `npm run package:lambdas`. Deploy `infra/live-broadcast.yml` using CloudFormation package with a private deployment bucket. Initially leave ScheduleState=DISABLED, invoke once with a connected test viewer and verify the payload, then update the stack with ScheduleState=ENABLED. CloudFormation provisions a dedicated execution role limited to reading the catalog/options, scanning and pruning socket connections, sending to the configured WebSocket API, and writing its logs. It grants no season/game write permissions.

Example for production:

```sh
aws cloudformation package --template-file infra/live-broadcast.yml --s3-bucket amplify-inseasonstanleycup-inseason-857e5-deployment --s3-prefix live-broadcast --output-template-file /tmp/live-broadcast.packaged.yml --profile inseason-admin --region us-east-1
aws cloudformation deploy --template-file /tmp/live-broadcast.packaged.yml --stack-name inseason-live-broadcast --capabilities CAPABILITY_IAM --parameter-overrides ScheduleState=DISABLED --profile inseason-admin --region us-east-1
```

After verification, repeat deploy with ScheduleState=ENABLED. Observe `/aws/lambda/inseason-live-broadcast` for sent/stale/failed counts and confirm two consecutive automatic messages on a client. If delivery regresses, set ScheduleState=DISABLED; the frontend continues polling. The older, unconfigured `publishGameUpdate` function is not used by this stack.

The saved-app startup background is declared in both `public/index.html` and `public/site.webmanifest`. Existing phone shortcuts may retain OS-cached launch metadata until reopened or re-added; once the HTML is received, the inline loading shell appears before JavaScript and catalog loading finish.
