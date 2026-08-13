#!/usr/bin/env bash
# Post-deploy smoke against production (or SMOKE_BASE).
# Whole site may sit behind Cloudflare Access — pass service token headers when set.
# SMOKE_DEMO=1 → public read-only demo (no Access, no export, library open GET).
set -euo pipefail
BASE="${SMOKE_BASE:-http://127.0.0.1:8787}"
UA="music-du-smoke/1.0"
DEMO="${SMOKE_DEMO:-}"

AUTH_HEADERS=(-A "$UA")
if [[ -z "$DEMO" && -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
  AUTH_HEADERS+=(
    -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}"
    -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}"
  )
fi

curl_json() {
  # usage: curl_json PATH [extra curl args...]
  local path="$1"; shift || true
  curl -fsS "${AUTH_HEADERS[@]}" "$BASE$path" "$@"
}

echo "==> health $BASE/api/health"
curl_json "/api/health" | python3 -c "
import sys, json, os
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert d.get('service') == 'music', d
demo = os.environ.get('SMOKE_DEMO')
if demo:
    assert d.get('readOnly') is True, d
    print('health ok DEMO readOnly project=', d.get('project'))
else:
    print('health ok', 'library_auth=', d.get('library_auth'))
"

echo "==> search"
search_ok=0
search_n=0
for i in 1 2 3 4 5; do
  if body=$(curl -sS "${AUTH_HEADERS[@]}" "$BASE/api/search?q=test&limit=1" 2>/dev/null); then
    if echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert isinstance(d.get('data'), list), d
print('search ok n=', len(d['data']))
"; then
      search_ok=1
      search_n=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data') or []))")
      break
    fi
  fi
  sleep 2
done
if [[ "$search_ok" != "1" ]]; then
  if [[ -n "$DEMO" ]]; then
    echo "demo search upstream unavailable — skip song resolve"
    search_ok=0
  else
    echo "search failed after retries"
    curl -sS "${AUTH_HEADERS[@]}" "$BASE/api/search?q=test&limit=1" | head -c 400 || true
    exit 1
  fi
fi

echo "==> song resolve"
if [[ -n "$DEMO" && "$search_ok" != "1" ]]; then
  echo "skip song resolve on demo (search upstream down)"
  song_ok=1
fi
# Brief retries — brand-new Worker / workers.dev can 404 for a few seconds
song_ok=${song_ok:-0}
if [[ "$song_ok" != "1" ]]; then
for i in 1 2 3 4 5; do
  if body=$(curl -fsS "${AUTH_HEADERS[@]}" "$BASE/api/song/1901371647?level=standard" 2>/dev/null); then
    if echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
url = (d.get('data') or {}).get('url') or ''
assert url.startswith('http'), d
print('song ok level=', (d.get('data') or {}).get('level'))
"; then
      song_ok=1
      break
    fi
  fi
  sleep 2
done
fi
if [[ "$song_ok" != "1" ]]; then
  echo "song resolve failed after retries"
  curl -sS "${AUTH_HEADERS[@]}" "$BASE/api/song/1901371647?level=standard" | head -c 400 || true
  exit 1
fi

if [[ -n "$DEMO" ]]; then
  echo "==> demo library GET (no token)"
  curl_json "/api/library" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert d.get('readOnly') is True, d
fav = (d.get('data') or {}).get('favorites') or []
print('library ok fav=', len(fav), 'revision=', (d.get('data') or {}).get('revision'))
assert len(fav) >= 1, 'favorites empty on demo — check D1 binding'
"
  echo "==> demo favs must be forbidden"
  code=$(curl -sS -A "$UA" -o /tmp/smoke-favs.body -w '%{http_code}' "$BASE/favs" || true)
  echo "favs HTTP $code"
  [[ "$code" == "403" ]] || { echo "expected favs 403 on demo"; head -c 200 /tmp/smoke-favs.body; exit 1; }
  echo "==> demo PUT library must be forbidden"
  code=$(curl -sS -A "$UA" -o /tmp/smoke-put.body -w '%{http_code}' \
    -X PUT -H 'Content-Type: application/json' \
    -d '{"favorites":[],"playlist":[],"history":[],"revision":0}' \
    "$BASE/api/library" || true)
  echo "PUT library HTTP $code"
  [[ "$code" == "403" ]] || { echo "expected PUT 403 on demo"; head -c 200 /tmp/smoke-put.body; exit 1; }
  echo "smoke-prod DEMO OK"
  exit 0
fi

echo "==> library (Cloudflare Access / service token only)"
curl -fsS "${AUTH_HEADERS[@]}" "$BASE/api/library" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
data = d.get('data') or {}
fav = data.get('favorites') or []
print('library ok fav=', len(fav), 'revision=', data.get('revision'))
assert len(fav) >= 1, 'favorites empty — check D1 restore'
"

echo "==> favs export (Access login or service token → 200 JSON)"
code=$(curl -sS "${AUTH_HEADERS[@]}" -o /tmp/smoke-favs.body -w '%{http_code}' "$BASE/favs" || true)
echo "favs HTTP $code"
case "$code" in
  200)
    python3 -c "
import json
d=json.load(open('/tmp/smoke-favs.body'))
assert 'favorites' in d or d.get('ok') is False
print('favs count', d.get('count', len(d.get('favorites') or [])))
"
    ;;
  301|302|303|307|308|401|403)
    # Browser Access wall without service token is acceptable for local runs
    if [[ -n "${CF_ACCESS_CLIENT_ID:-}" ]]; then
      echo "unexpected Access block with service token configured"
      head -c 200 /tmp/smoke-favs.body || true
      exit 1
    fi
    echo "favs behind Access login (ok without service token)"
    ;;
  *)
    echo "unexpected favs status $code"
    head -c 200 /tmp/smoke-favs.body || true
    exit 1
    ;;
esac

echo "smoke-prod OK"
