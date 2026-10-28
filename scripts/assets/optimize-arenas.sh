#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Original PNGs remain the source artwork. Webpack hashes the WebP output URLs.
for name in black-rink-arena-v2 thunderkeep-ice-v1 spotlight-pit-v1 venom-vault-v1 portal-rink-v1; do
  cwebp -quiet -q 85 -m 6 "src/assets/arcade/$name.png" -o "src/assets/arcade/$name.webp"
done
