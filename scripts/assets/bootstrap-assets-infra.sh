#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${ASSET_BUCKET:-}" ]]; then
  echo "ASSET_BUCKET is required (example: inseasoncup-assets-prod)."
  exit 1
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-inseason-admin}"
ORIGIN_DOMAIN="${ASSET_BUCKET}.s3.${AWS_REGION}.amazonaws.com"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Step 1/5: Creating bucket (if missing)"
if AWS_PAGER="" aws s3api head-bucket --bucket "$ASSET_BUCKET" --profile "$AWS_PROFILE" >/dev/null 2>&1; then
  echo "Bucket already exists: $ASSET_BUCKET"
else
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    AWS_PAGER="" aws s3api create-bucket \
      --bucket "$ASSET_BUCKET" \
      --profile "$AWS_PROFILE"
  else
    AWS_PAGER="" aws s3api create-bucket \
      --bucket "$ASSET_BUCKET" \
      --region "$AWS_REGION" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" \
      --profile "$AWS_PROFILE"
  fi
fi

echo "Step 2/5: Enforcing private bucket access"
AWS_PAGER="" aws s3api put-public-access-block \
  --bucket "$ASSET_BUCKET" \
  --public-access-block-configuration \
"BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --profile "$AWS_PROFILE"

cat > "$tmp_dir/oac.json" <<JSON
{
  "Name": "inseasoncup-assets-oac",
  "Description": "OAC for inseasoncup image assets bucket",
  "SigningProtocol": "sigv4",
  "SigningBehavior": "always",
  "OriginAccessControlOriginType": "s3"
}
JSON

echo "Step 3/5: Creating Origin Access Control"
oac_id="$(
  AWS_PAGER="" aws cloudfront create-origin-access-control \
    --origin-access-control-config file://"$tmp_dir/oac.json" \
    --profile "$AWS_PROFILE" \
    --query 'OriginAccessControl.Id' \
    --output text
)"

cat > "$tmp_dir/distribution-config.json" <<JSON
{
  "CallerReference": "inseasoncup-assets-$(date +%s)",
  "Comment": "Static image assets for In Season Cup",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "s3-${ASSET_BUCKET}",
        "DomainName": "${ORIGIN_DOMAIN}",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        },
        "OriginAccessControlId": "${oac_id}"
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-${ASSET_BUCKET}",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  },
  "DefaultRootObject": "",
  "PriceClass": "PriceClass_100"
}
JSON

echo "Step 4/5: Creating CloudFront distribution"
distribution_meta="$(
  AWS_PAGER="" aws cloudfront create-distribution \
    --distribution-config file://"$tmp_dir/distribution-config.json" \
    --profile "$AWS_PROFILE" \
    --query 'Distribution.[Id,DomainName]' \
    --output text
)"

distribution_id="$(printf '%s' "$distribution_meta" | awk '{print $1}')"
distribution_domain="$(printf '%s' "$distribution_meta" | awk '{print $2}')"

if [[ -z "$distribution_id" || -z "$distribution_domain" ]]; then
  echo "Failed to parse distribution output."
  echo "$distribution_meta"
  exit 1
fi

cat > "$tmp_dir/bucket-policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontReadOnly",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${ASSET_BUCKET}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::$(AWS_PAGER="" aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text):distribution/${distribution_id}"
        }
      }
    }
  ]
}
JSON

echo "Step 5/5: Applying bucket policy for CloudFront OAC"
AWS_PAGER="" aws s3api put-bucket-policy \
  --bucket "$ASSET_BUCKET" \
  --policy file://"$tmp_dir/bucket-policy.json" \
  --profile "$AWS_PROFILE"

echo "Infrastructure bootstrap complete."
echo "Bucket: $ASSET_BUCKET"
echo "Distribution ID: $distribution_id"
echo "Distribution domain: https://$distribution_domain"
echo "Next: set VUE_APP_ASSET_BASE_URL=https://$distribution_domain in Amplify."
