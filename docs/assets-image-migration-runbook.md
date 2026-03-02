# Assets Image Migration Runbook (S3 + CloudFront)

This runbook migrates player avatars and custom team logos from local app-bundled imports to remote assets served from S3 + CloudFront.

## Scope
- Player images:
  - `players/season1/<name>-<mood>.webp`
  - `players/season2/<name>-<mood>.webp`
- Team logos:
  - `team-logos/season2/<TEAM>.webp`
- Optional version prefix:
  - `v1/players/...`
  - `v1/team-logos/...`

## Prereqs
- AWS CLI configured with write access to S3 + CloudFront.
- Profile defaults used by scripts: `inseason-admin`.
- `cwebp` installed:
  - `brew install webp`

## 1) Create bucket + CloudFront (OAC)
```bash
export ASSET_BUCKET=inseasoncup-assets-prod
export AWS_REGION=us-east-1
export AWS_PROFILE=inseason-admin

scripts/assets/bootstrap-assets-infra.sh
```

Output includes:
- CloudFront distribution ID
- CloudFront domain (used as `VUE_APP_ASSET_BASE_URL`)

## 2) Optimize local PNG assets into WebP
```bash
export ASSET_BUILD_DIR=/tmp/inseasoncup-assets-build
export PLAYER_WEBP_QUALITY=82
export TEAM_LOGO_WEBP_QUALITY=92
export TEAM_LOGO_LOSSLESS=false

scripts/assets/optimize-images.sh
```

## 3) Upload with immutable caching headers
```bash
export ASSET_BUCKET=inseasoncup-assets-prod
export ASSET_PREFIX=v1
export AWS_REGION=us-east-1
export AWS_PROFILE=inseason-admin
export ASSET_BUILD_DIR=/tmp/inseasoncup-assets-build

scripts/assets/upload-assets.sh
```

This uploads `*.webp` with:
- `Cache-Control: public,max-age=31536000,immutable`
- `Content-Type: image/webp`

## 4) App config cutover
Set Amplify env vars:
- `VUE_APP_ASSET_BASE_URL=https://<cloudfront-domain-or-assets-domain>`
- `VUE_APP_ASSET_VERSION=v1` (optional, recommended)

Then trigger Amplify release.

## 5) Verification
1. Object metadata:
```bash
aws s3api head-object \
  --bucket "$ASSET_BUCKET" \
  --key "v1/players/season2/boz-happy.webp" \
  --region us-east-1 \
  --profile inseason-admin
```
2. CDN response headers:
```bash
curl -I "https://<asset-domain>/v1/players/season2/boz-happy.webp"
curl -I "https://<asset-domain>/v1/team-logos/season2/BOS.webp"
```
3. App behavior:
- Home page, standings, player profile show avatars/logos.
- No broken image icons.
- Network requests return 200 and cache headers.

## Rollback
Fast rollback (no code revert needed):
1. Unset `VUE_APP_ASSET_BASE_URL` (or set to empty) in Amplify env vars.
2. Redeploy frontend.

Reason: app is remote-first but keeps local fallback imports for player/team images.
