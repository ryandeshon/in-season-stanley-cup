# Caching strategy

This project now ships a caching plan that keeps static assets cheap to serve and reduces Lambda/API Gateway work on quiet days. The approach is intentionally simple: CloudFront + Cache-Control headers, with long-lived, versioned assets and short-lived dynamic data.

## Static assets (images, JS, CSS)
- Build output already uses hashed filenames (`yarn build` emits `*.js`/`*.css` with content hashes) so URLs are versioned by default.
- Host `dist/` on S3 behind CloudFront. Upload with long-lived headers for assets and short-lived headers for HTML:
  ```bash
  # One-time setup: export your bucket name
  export STATIC_BUCKET=in-season-cup-static

  # Cache assets for a year; rely on hashed filenames for versioning
  aws s3 sync dist/ s3://$STATIC_BUCKET/ \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html"

  # Keep HTML short-lived so new deploys are picked up quickly
  aws s3 cp dist/index.html s3://$STATIC_BUCKET/index.html \
    --cache-control "public, max-age=300, must-revalidate"
  ```
- In CloudFront, set the behavior to “Use origin cache headers” so the above metadata controls the edge/browser TTLs. No invalidations are needed when assets change because filenames are versioned.
- For any hand-placed images (e.g., in `public/`), follow the same pattern: append a version (`logo-v2.png`) or let the build pipeline fingerprint them, then apply the long-lived cache header on upload.

## API/data caching
- The HTTP API Lambda now returns `Cache-Control` and `CDN-Cache-Control` headers so CloudFront can cache responses at the edge and browsers can reuse them.
- Default TTLs (overridable via env vars):
  - `/champion` + `/gameid`  
    - Non–playing day (champion not on today’s schedule): `max-age=86400` (24h) with `stale-while-revalidate` 1h.  
    - Playing day or schedule lookup failure: `max-age=300` (5m).
  - `/players`: `max-age=21600` (6h) with `stale-while-revalidate` 1h.
  - `/game-records`: `max-age=900` (15m).
  - Patch/POST routes remain uncached.
- Env knobs (all seconds): `NON_PLAYING_DAY_CACHE_TTL`, `PLAYING_DAY_CACHE_TTL`, `PLAYERS_CACHE_TTL`, `GAME_RECORDS_CACHE_TTL`, `STALE_WHILE_REVALIDATE`, `STALE_WHILE_REVALIDATE_LONG`, `STALE_IF_ERROR`.
- For CloudFront, keep the cache policy on these paths set to “respect origin Cache-Control” (or set a default TTL >= the origin header); allow query strings and headers as needed.

## Invalidation and freshness
- Static images: rely on filename versioning; no invalidation required. If you ever need to force refresh shared assets, invalidate `/index.html` or the specific path in CloudFront.
- API: TTLs handle most freshness needs. For rare schedule changes or bug fixes, invalidate the CloudFront paths you need (e.g., `/champion`, `/gameid`)—these paths are small and cheap to invalidate.

## Verification and monitoring
- Spot-check headers:
  ```bash
  curl -I https://<cloudfront-domain>/champion
  curl -I https://<cloudfront-domain>/players
  ```
  Confirm `Cache-Control` and `CDN-Cache-Control` match the expected TTL.
- In the browser, reload the homepage and confirm images show `from memory cache` / `from disk cache` after the first request.
- Watch CloudFront `X-Cache` values (`Miss` → `Hit`) and compare Lambda/API Gateway invocation counts before/after enabling the cache behavior.
