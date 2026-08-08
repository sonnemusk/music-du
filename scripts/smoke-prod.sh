#!/usr/bin/env bash
# Post-deploy smoke against production (or SMOKE_BASE).
# Whole site may sit behind Cloudflare Access — pass service token headers when set.
set -euo pipefail
BASE="${SMOKE_BASE:-https://music.dubin.cc}"
UA="music-du-smoke/1.0"

AUTH_HEADERS=(-A "$UA")
if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
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
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert d.get('service') == 'music', d
print('health ok', 'library_auth=', d.get('library_auth'))
"

echo "==> search"
curl_json "/api/search?q=test&limit=1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert isinstance(d.get('data'), list), d
print('search ok n=', len(d['data']))
"

echo "==> song resolve"
curl_json "/api/song/1901371647?level=standard" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
url = (d.get('data') or {}).get('url') or ''
assert url.startswith('http'), d
print('song ok level=', (d.get('data') or {}).get('level'))
"

echo "==> library (token when configured)"
if [[ -n "${MUSIC_ACCESS_TOKEN:-}" ]]; then
  curl -fsS "${AUTH_HEADERS[@]}" -H "X-Music-Token: ${MUSIC_ACCESS_TOKEN}" \
    "$BASE/api/library" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
data = d.get('data') or {}
fav = data.get('favorites') or []
print('library ok fav=', len(fav), 'revision=', data.get('revision'))
assert len(fav) >= 1, 'favorites empty — check D1 restore'
"
else
  echo "skip library (no MUSIC_ACCESS_TOKEN in env)"
fi

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
