#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

failures=0

echo "[security-scan] Running repository security checks..."

# 1) Guard against sensitive files being tracked.
for forbidden in .env .env.local amplify/team-provider-info.json inseason-http-api.deploy.zip; do
  if git ls-files --error-unmatch "$forbidden" >/dev/null 2>&1; then
    echo "[security-scan] FAIL: tracked sensitive file: $forbidden"
    failures=1
  fi
done

# 2) Scan tracked source/docs/config for high-risk token patterns.
# Build a list of tracked files that still exist in the working tree.
TRACKED_EXISTING_FILE_LIST=".security-scan-files.txt"
git ls-files | while IFS= read -r file; do
  case "$file" in
    ai/SECURITY.md|scripts/security-scan.sh|amplify/team-provider-info.example.json|docs/aws-cache-rollout-runbook.md)
      continue
      ;;
  esac
  [[ -f "$file" ]] && printf '%s\n' "$file"
done >"$TRACKED_EXISTING_FILE_LIST"

if [[ ! -s "$TRACKED_EXISTING_FILE_LIST" ]]; then
  echo "[security-scan] FAIL: no tracked files found to scan"
  exit 1
fi

TRACKED_EXISTING_FILES="$(cat "$TRACKED_EXISTING_FILE_LIST")"

if rg -n \
  --hidden \
  --glob '!.git' \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!yarn.lock' \
  --glob '!package-lock.json' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e 'ASIA[0-9A-Z]{16}' \
  -e 'aws_access_key_id' \
  -e 'aws_secret_access_key' \
  -e 'BEGIN (RSA|EC|OPENSSH|DSA|PGP|PRIVATE) KEY' \
  -e '[a-z0-9]{10}\\.execute-api\\.[a-z0-9-]+\\.amazonaws\\.com' \
  -e '[a-z0-9-]+\\.cloudfront\\.net' \
  -e 'arn:aws:[^<]+' \
  $TRACKED_EXISTING_FILES >/tmp/security-scan-matches.txt; then
  echo "[security-scan] FAIL: found potentially sensitive matches:"
  cat /tmp/security-scan-matches.txt
  failures=1
fi

if [[ "$failures" -ne 0 ]]; then
  rm -f "$TRACKED_EXISTING_FILE_LIST"
  echo "[security-scan] FAILED"
  exit 1
fi

rm -f "$TRACKED_EXISTING_FILE_LIST"
echo "[security-scan] PASSED"
