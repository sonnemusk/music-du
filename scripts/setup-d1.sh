#!/usr/bin/env bash
# Create free-tier D1 for Music-Du with a human-readable dashboard name.
# Default name: Music-Du-Library  (NOT a random slug — easy to find in CF UI)
# Requires: wrangler login (or CLOUDFLARE_API_TOKEN)
set -euo pipefail
cd "$(dirname "$0")/.."

# Always prefix with Music-Du so CF console is scannable
NAME="${1:-Music-Du-Library}"
echo "==> Creating D1 database: $NAME (free tier, Music project)"
OUT=$(npx wrangler d1 create "$NAME" 2>&1) || true
echo "$OUT"

ID=$(echo "$OUT" | sed -n 's/.*database_id *= *"\([^"]*\)".*/\1/p' | head -1)
if [[ -z "${ID:-}" ]]; then
  ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
fi

if [[ -z "${ID:-}" ]]; then
  echo ""
  echo "Could not parse database_id. If the DB already exists:"
  echo "  npx wrangler d1 list"
  echo "Look for name: Music-Du-Library"
  exit 1
fi

echo ""
echo "==> Put this in wrangler.toml (binding name stays readable too):"
cat <<EOF

[[d1_databases]]
binding = "MUSIC_DU_DB"
database_name = "$NAME"
database_id = "$ID"
migrations_dir = "migrations"
EOF

echo ""
echo "Note: database_id is Cloudflare's internal UUID (required by API)."
echo "      What you read in the dashboard list is database_name = $NAME"
echo ""
echo "==> Applying migrations..."
npx wrangler d1 migrations apply "$NAME" --remote || npx wrangler d1 execute "$NAME" --remote --file=./migrations/0001_library.sql

echo "Done. npm run build && npx wrangler deploy"
