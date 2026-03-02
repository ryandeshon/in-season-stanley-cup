#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${ASSET_BUILD_DIR:-/tmp/inseasoncup-assets-build}"
PLAYER_QUALITY="${PLAYER_WEBP_QUALITY:-82}"
TEAM_LOGO_QUALITY="${TEAM_LOGO_WEBP_QUALITY:-92}"
TEAM_LOGO_LOSSLESS="${TEAM_LOGO_LOSSLESS:-false}"

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp is required. Install webp tools first."
  echo "macOS: brew install webp"
  exit 1
fi

echo "Building optimized assets into: $OUT_DIR"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/players/season1" "$OUT_DIR/players/season2" "$OUT_DIR/team-logos/season2"

for season in season1 season2; do
  while IFS= read -r -d '' file; do
    base_name="$(basename "${file%.png}")"
    output="$OUT_DIR/players/$season/${base_name}.webp"
    cwebp -quiet -q "$PLAYER_QUALITY" "$file" -o "$output"
  done < <(find "$ROOT_DIR/src/assets/players/$season" -type f -name '*.png' -print0)
done

while IFS= read -r -d '' file; do
  base_name="$(basename "${file%.png}")"
  output="$OUT_DIR/team-logos/season2/${base_name}.webp"
  if [[ "$TEAM_LOGO_LOSSLESS" == "true" ]]; then
    cwebp -quiet -lossless "$file" -o "$output"
  else
    cwebp -quiet -q "$TEAM_LOGO_QUALITY" "$file" -o "$output"
  fi
done < <(find "$ROOT_DIR/src/assets/team-logos/season2" -type f -name '*.png' -print0)

players_count="$(find "$OUT_DIR/players" -type f -name '*.webp' | wc -l | tr -d ' ')"
logos_count="$(find "$OUT_DIR/team-logos" -type f -name '*.webp' | wc -l | tr -d ' ')"

echo "Completed optimization."
echo "Generated player images: $players_count"
echo "Generated team logos: $logos_count"
