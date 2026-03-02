#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${ASSET_BUCKET:-}" ]]; then
  echo "ASSET_BUCKET is required (example: inseasoncup-assets-prod)."
  exit 1
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-inseason-admin}"
ASSET_BUILD_DIR="${ASSET_BUILD_DIR:-/tmp/inseasoncup-assets-build}"
ASSET_PREFIX="${ASSET_PREFIX:-}"
CACHE_CONTROL_HEADER="${CACHE_CONTROL_HEADER:-public,max-age=31536000,immutable}"

if [[ ! -d "$ASSET_BUILD_DIR" ]]; then
  echo "Asset build directory not found: $ASSET_BUILD_DIR"
  echo "Run scripts/assets/optimize-images.sh first."
  exit 1
fi

DESTINATION="s3://$ASSET_BUCKET"
if [[ -n "$ASSET_PREFIX" ]]; then
  DESTINATION="$DESTINATION/$ASSET_PREFIX"
fi

echo "Uploading optimized assets to $DESTINATION"
AWS_PAGER="" aws s3 sync "$ASSET_BUILD_DIR/" "$DESTINATION/" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --exclude "*" \
  --include "*.webp" \
  --cache-control "$CACHE_CONTROL_HEADER" \
  --content-type image/webp

sample_file="$(find "$ASSET_BUILD_DIR" -type f -name '*.webp' | head -n 1)"
if [[ -n "$sample_file" ]]; then
  sample_key="${sample_file#"$ASSET_BUILD_DIR"/}"
  if [[ -n "$ASSET_PREFIX" ]]; then
    sample_key="$ASSET_PREFIX/$sample_key"
  fi
  echo "Verifying sample object metadata: $sample_key"
  AWS_PAGER="" aws s3api head-object \
    --bucket "$ASSET_BUCKET" \
    --key "$sample_key" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query '{ContentType:ContentType, CacheControl:CacheControl, LastModified:LastModified}'
fi

echo "Upload complete."
