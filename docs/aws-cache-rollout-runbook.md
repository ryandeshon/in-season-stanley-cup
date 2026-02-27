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
