#!/usr/bin/env bash
# Create free-tier D1 for music-du (lowercase name for Cloudflare dashboard).
# Default: music-du-library
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-music-du-library}"
echo "==> Creating D1 database: $NAME"
OUT=$(npx wrangler d1 create "$NAME" 2>&1) || true
echo "$OUT"

ID=$(echo "$OUT" | sed -n 's/.*database_id *= *"\([^"]*\)".*/\1/p' | head -1)
if [[ -z "${ID:-}" ]]; then
  ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
fi

if [[ -z "${ID:-}" ]]; then
  echo "Could not parse database_id. Run: npx wrangler d1 list"
  exit 1
fi

echo ""
echo "Put into wrangler.toml:"
cat <<EOF

[[d1_databases]]
binding = "MUSIC_DU_DB"
database_name = "$NAME"
database_id = "$ID"
migrations_dir = "migrations"
EOF

echo ""
npx wrangler d1 migrations apply "$NAME" --remote || npx wrangler d1 execute "$NAME" --remote --file=./migrations/0001_library.sql
echo "Done."
