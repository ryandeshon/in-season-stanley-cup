# AWS Cache Rollout Runbook

This runbook documents the production caching rollout completed on February 22-23, 2026 (US Eastern), including the AWS resources created/updated, verification steps, and rollback steps.

Security note: this repository is public. Do not commit raw account IDs, ARNs, API IDs, distribution IDs, or private profile names in this document. Keep those values in a private operator note outside git.

## Scope
- Frontend static asset/browser caching via Amplify Hosting custom headers
- API edge caching via CloudFront in front of API Gateway (`inseason-http`)
- Custom API hostname (`api.inseasoncup.com`) on CloudFront
- Backend Lambda cache headers (`inseason-http-api`)

## Production resources
- AWS account: `<ACCOUNT_ID>`
- Region: `<AWS_REGION>`
- Amplify app (frontend): `<AMPLIFY_APP_ID>` (`<AMPLIFY_APP_NAME>`)
- Amplify branch: `main`
- API Gateway (HTTP API): `<HTTP_API_ID>` (`inseason-http`)
- API stage: `prod`
- API Lambda: `inseason-http-api`
- API CloudFront distribution: `<API_CF_DISTRIBUTION_ID>`
- API CloudFront domain: `<API_CF_DOMAIN>`
- API custom hostname: `api.inseasoncup.com`
- ACM certificate (API custom hostname): `<API_CF_CERT_ARN>`
- CloudFront custom cache policy (API + CORS-safe `Origin` cache key): `<API_CF_CACHE_POLICY_ID>`

## What was changed

### 1. Amplify Hosting custom headers (static assets)
- Added Amplify `customHeaders` to set:
  - `/index.html` -> `Cache-Control: public, max-age=300, must-revalidate`
  - asset file types (`js`, `css`, `png`, `svg`, fonts, etc.) -> `Cache-Control: public, max-age=31536000, immutable`

### 2. Backend Lambda (`inseason-http-api`) deployed
- Deployed updated `lambdas/http-api/index.js` and `lambdas/http-api/package.json` to Lambda `inseason-http-api`
- This enables `Cache-Control` / `CDN-Cache-Control` headers with TTLs:
  - `/champion`, `/gameid`: playing day vs non-playing day TTL logic
  - `/players`, `/game-records`: fixed TTLs

### 3. CloudFront distribution for API
- Created CloudFront distribution in front of API Gateway origin:
  - Origin host: `<HTTP_API_ID>.execute-api.<AWS_REGION>.amazonaws.com`
  - Origin path: `/prod`
- Cache behaviors:
  - Cached: `/champion`, `/gameid`, `/players`, `/game-records`
  - Default behavior: uncached (preserves POST/PATCH/etc.)

### 4. Custom API hostname
- Requested ACM certificate for `api.inseasoncup.com` in `us-east-1`
- Added ACM DNS validation CNAME in Route 53
- Attached cert + alias to CloudFront distribution `<API_CF_DISTRIBUTION_ID>`
- Added Route 53 alias `A` and `AAAA` records for `api.inseasoncup.com` -> `<API_CF_DOMAIN>`

### 5. Frontend API base URL cutover
- Updated Amplify app environment variables:
  - `VUE_APP_API_BASE=https://api.inseasoncup.com`
  - `VITE_API_BASE=https://api.inseasoncup.com`
- Triggered Amplify `main` release rebuild

## Verification checklist

### API origin headers (direct API Gateway)
```bash
curl -s -D - -o /dev/null https://<HTTP_API_ID>.execute-api.<AWS_REGION>.amazonaws.com/prod/champion
curl -s -D - -o /dev/null https://<HTTP_API_ID>.execute-api.<AWS_REGION>.amazonaws.com/prod/players
```
- Expect `Cache-Control` and `CDN-Cache-Control` headers.

### API edge caching (CloudFront raw domain)
```bash
curl -s -D - -o /dev/null -H 'Origin: https://www.inseasoncup.com' https://<API_CF_DOMAIN>/champion
curl -s -D - -o /dev/null -H 'Origin: https://www.inseasoncup.com' https://<API_CF_DOMAIN>/champion
```
- Expect `Age` on subsequent requests and increasing over time (cache hit).

### API custom hostname
```bash
curl -s -D - -o /dev/null -H 'Origin: https://www.inseasoncup.com' https://api.inseasoncup.com/champion
```
- Expect `200`, `Cache-Control`, and `Age`.

### Frontend bundle uses custom API hostname
```bash
curl -sL https://www.inseasoncup.com/ | rg -o '/js/[^" ]+\\.js' -m 1
curl -sL https://www.inseasoncup.com/js/<bundle>.js | rg 'api\\.inseasoncup\\.com'
```

### Static asset caching (Amplify Hosting)
Check response headers in browser devtools or with `curl` against deployed asset URLs:
- `Cache-Control: public, max-age=31536000, immutable` for hashed assets
- `Cache-Control: public, max-age=300, must-revalidate` for HTML entrypoint behavior (served via rewrite)

## Operational commands

### Check Amplify app env vars
```bash
aws amplify get-app \
  --app-id <AMPLIFY_APP_ID> \
  --region <AWS_REGION> \
  --profile <AWS_PROFILE> \
  --query 'app.environmentVariables'
```

### Trigger Amplify production rebuild
```bash
aws amplify start-job \
  --app-id <AMPLIFY_APP_ID> \
  --branch-name main \
  --job-type RELEASE \
  --region <AWS_REGION> \
  --profile <AWS_PROFILE>
```

### Check Amplify job status
```bash
aws amplify get-job \
  --app-id <AMPLIFY_APP_ID> \
  --branch-name main \
  --job-id <job-id> \
  --region <AWS_REGION> \
  --profile <AWS_PROFILE> \
  --query 'job.summary.status' \
  --output text
```

### Check CloudFront distribution status
```bash
aws cloudfront get-distribution \
  --id <API_CF_DISTRIBUTION_ID> \
  --profile <AWS_PROFILE> \
  --query 'Distribution.Status' \
  --output text
```

## Rollback options

### Fast rollback (frontend only)
Use if the custom API hostname has an issue but the CloudFront raw domain works.

1. Set Amplify env vars back to raw CloudFront domain:
   - `VUE_APP_API_BASE=https://<API_CF_DOMAIN>`
   - `VITE_API_BASE=https://<API_CF_DOMAIN>`
2. Trigger Amplify `main` rebuild.

### Rollback to direct API Gateway (frontend only)
Use if API CloudFront itself has issues.

1. Set Amplify env vars back to direct API Gateway:
   - `VUE_APP_API_BASE=https://<HTTP_API_ID>.execute-api.<AWS_REGION>.amazonaws.com/prod`
   - `VITE_API_BASE=https://<HTTP_API_ID>.execute-api.<AWS_REGION>.amazonaws.com/prod`
2. Trigger Amplify `main` rebuild.

### Disable edge caching without deleting resources
Use if you want to keep the distribution but stop caching behavior quickly.

1. Update CloudFront cached path behaviors (`/champion`, `/gameid`, `/players`, `/game-records`) to use `Managed-CachingDisabled` (`4135ea2d-6df8-44a3-9df3-4b5a84be39ad`)
2. Wait for CloudFront deploy

### Remove custom API hostname (if needed)
1. Remove `api.inseasoncup.com` alias from CloudFront distribution and revert viewer certificate to default CloudFront cert (or another cert)
2. Wait for CloudFront deploy
3. Remove Route 53 `A`/`AAAA` alias records for `api.inseasoncup.com`

## Known caveats
- API Gateway `HEAD` requests to these routes return `404` because routes are configured as `ANY` and the Lambda/mapping behavior is currently validated via `GET`. Use `GET` for header checks.
- `access-control-allow-origin` may appear as `*` via API Gateway/CloudFront even when Lambda computes origin-specific headers; current CORS config on the HTTP API allows `*`.

## Cleanup (optional)
- Remove temporary local deployment zip if present:
  - `inseason-http-api.deploy.zip`

## 3.1.0 traffic audit — October 27, 2026 (Eastern)

Read-only audit used Cost Explorer, CloudWatch, CloudTrail, CloudFront configurations/invalidation history, Amplify build configuration, and actual response headers. No monitoring infrastructure was added. Counts below use October 1–27 UTC buckets; the final bucket/billing data can still settle.

### Findings and attribution

- **Confirmed CloudFront cost driver: invalidations on API distribution `E13BE191EHKQ29` (`api.inseasoncup.com`).** October-to-date: 3,417 invalidated paths and $12.085 in invalidation charges; other CloudFront charges total less than $0.001. This is separate from Amplify hosting charges.
- CloudTrail attributes repeated `/champion`, `/gameid`, `/check-status` invalidations to `inseason-http-role/inseason-check-game`. The latest three have the same game ID `2026020181` and timestamps 15 minutes apart. The checker used `Date.now()` in CallerReference and invalidated even after its idempotent finalization found an existing record.
- All API distribution behaviors currently use **Managed-CachingDisabled**, Min/Default/Max TTL all zero. Consequently these invalidations evict no cached API responses. Logging is disabled, so aggregate request counts do not establish which browser/page generated traffic.
- The asset distribution `EZEE3RFK3R02J` has no invalidations; unrelated distribution `EWT53M0KTWFY1` also has none and no metric datapoints in this audit. No explicit invalidation commands exist in frontend deployment/upload scripts. Amplify owns its frontend distribution/deployment cache management; it is not exposed in this account's distribution list. Its internal invalidation history was not available, so it is not claimed to be zero.

| October metric | API CloudFront | Asset CloudFront | Amplify hosting app `d2035onwm2yvhk` |
| --- | ---: | ---: | ---: |
| Requests | 16,870 | 174 | 95,526 |
| Download bytes | 9,205,099 | 10,919,705 | 3,168,418,426 |
| 5xx | daily rate 0% | daily rate 0% | 0 errors |

Amplify's largest daily request/download totals were October 1 UTC: 14,562 requests / 547,135,901 bytes. It recorded 20,845 4xx responses in October; API daily 4xx rates also peak above 70% on low-volume days. These are distinct observations, not proof that polling or invalidations caused them. Existing aggregate metrics cannot identify visitors/bots or individual asset requests. The API's largest request day across September–October was September 27 UTC (8,807 requests), coinciding with draft day; correlation is not causal attribution.

### Mechanisms and changes

- **Browser polling:** JavaScript decides whether to make a request. Completed draft tabs stop polling; hidden draft/home tabs pause refreshes and close sockets. A visible draft uses socket events, with a 30-second fallback when disconnected and a two-minute reconciliation when connected but no state sync has occurred. Broadcasts originate in the sending browser after the HTTP commit, so connection status alone cannot guarantee delivery. Completed drafts retain socket updates while visible so undo/restart still works. Reconnection/tab return catches up. Draft authentication, version checks, write permissions and season isolation are unchanged. Current production Season 3 already disallows drafting: the previous `loadInitialData` guard prevented its polling callbacks from issuing draft HTTP requests, although the socket still opened. The completed-draft savings apply to a completed draft while its season remains draft-enabled.
- **Homepage polling:** visible off-day/postgame state refresh is every 15 minutes instead of 5; active-game identity remains every 5 minutes. Hidden periodic HTTP traffic is zero. Visible return rechecks after one minute (errors recover immediately), and catches up a stale active game. Scheduled boxscores are not polled before start time. Healthy minute-by-minute socket broadcasts no longer trigger duplicate polls after only 30 seconds; connected-but-stale fallback starts after 90 seconds, checked every 30 seconds. Disconnected live polling stays every 30 seconds. Final-result and noon-cutoff refresh behavior remains, with hidden cutoff refresh deferred until return. Homepage history already loaded on mount/season change, not every five minutes; no fabricated history-poll saving is counted.
- **Browser caching:** forced API refreshes use `fetch(cache: 'no-cache')` to revalidate the existing season-scoped URL instead of adding `_ts`. Auth headers and request methods are unchanged. This still requests fresh data; it does not create a long-lived API cache. The existing PNG arena header was verified as `public, max-age=31536000, immutable`.
- **CloudFront caching:** API caching remains disabled. No change to authenticated API caching or origin request forwarding. Asset/hosting caching remains enabled where already configured. The new `customHttp.yml` preserves existing hosting headers and adds the same immutable header for WebP.
- **Invalidations:** remove `API_CACHE_DISTRIBUTION_ID` from the production checker only, since its distribution caches nothing. No wildcard/manual deployment invalidation is issued. If API caching is deliberately enabled later, first review TTLs, query-string season variants and affected paths, then configure necessary invalidations. Optional invalidation caller references are now stable per season/game/path set, including across retries/restarts, so retries cannot create new billable invalidations. Retry capability is retained for transient invalidation failures.
- **Image transfer:** five arenas use WebP quality 85, unchanged dimensions, with original PNG source artwork retained. Webpack creates content-hashed URLs, so new artwork does not require invalidation. Reproduce with `bash scripts/assets/optimize-arenas.sh`.

| Arena | Original bytes | WebP bytes |
| --- | ---: | ---: |
| Black Rink | 2,429,533 | 278,246 |
| Thunderkeep | 3,209,929 | 422,166 |
| Spotlight | 2,723,277 | 331,622 |
| Venom | 2,723,972 | 308,646 |
| Portal | 2,902,853 | 312,394 |

Combined: 13,989,564 → 1,653,074 bytes, **88.2% smaller**, measured on disk. A page need not download all five; this is not an 88% reduction in total site bandwidth. Originals are not imported by the runtime.

### Expected reductions and freshness tradeoffs

- Draft fallback: 1,440 GETs/hour (two every five seconds) → at most 240/hour disconnected; at most 60/hour for a quiet connected active draft, zero periodic GETs when completed/hidden, excluding initial load, user actions, socket updates and necessary catch-up reads. These are calculated upper bounds and tested with simulated time, not production analytics.
- Visible idle home: 36 GETs/hour (three per refresh) → 12/hour, a 67% reduction in periodic requests. Hidden periodic requests: zero. Live sockets at a one-minute cadence: zero duplicate boxscore polling in the one-hour test. Initialization and legitimate game transitions are excluded.
- Idle discovery can lag by up to 15 minutes; returning after a minute checks immediately. A connected socket that silently stops sending may take 90–120 seconds to trigger HTTP fallback; a disconnected one retains the 30-second fallback. Missing draft updates during disconnection can take up to 30 seconds to appear; a missed browser-originated broadcast while connected is repaired within two minutes. Completed views do not poll; they catch up via socket, reconnection, tab return or reload, including after an undo. No draft action or final-game write is delayed by these intervals.
- Current production invalidation requests should fall to zero while the API policy remains CachingDisabled, with no edge-cache freshness penalty. Avoid treating the observed $12.085 as a guaranteed monthly saving; it is a partial-month baseline.

### Validation and rollout

Unit tests simulate an hour of hidden/home/completed-draft traffic, reconnect/undo and fresh socket updates. Browser tests assert both completed draft pages issue only their initial roster/state reads across a simulated hour. The full regression suite covers draft actions/auth conflicts, archived seasons, postgame retention/noon expiry, game effects and mobile pages. Integration tests use disposable DynamoDB tables, never live draft resets.

Before checker deployment, save its package and complete configuration securely. Remove only `API_CACHE_DISTRIBUTION_ID`, preserving all other environment values; deploy the packaged checker and wait for Successful. Rollback restores the old package/configuration (restoring the invalidation variable would also restore unnecessary costs). Frontend follows the normal PR/CI/Amplify workflow. Confirm hashed WebP URLs, response caching, rendered version and current game/standings after deployment; production traffic savings require subsequent usage, not just a successful deploy.
