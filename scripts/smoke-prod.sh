#!/usr/bin/env bash
# Post-deploy smoke against production (or SMOKE_BASE).
set -euo pipefail
BASE="${SMOKE_BASE:-https://music.dubin.cc}"
UA="music-du-smoke/1.0"

echo "==> health $BASE/api/health"
curl -fsS -A "$UA" "$BASE/api/health" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert d.get('service') == 'music', d
print('health ok', 'library_auth=', d.get('library_auth'))
"

echo "==> search"
curl -fsS -A "$UA" "$BASE/api/search?q=test&limit=1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
assert isinstance(d.get('data'), list), d
print('search ok n=', len(d['data']))
"

echo "==> song resolve"
curl -fsS -A "$UA" "$BASE/api/song/1901371647?level=standard" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
url = (d.get('data') or {}).get('url') or ''
assert url.startswith('http'), d
print('song ok level=', (d.get('data') or {}).get('level'))
"

echo "==> library (requires token when configured)"
if [[ -n "${MUSIC_ACCESS_TOKEN:-}" ]]; then
  curl -fsS -A "$UA" -H "X-Music-Token: ${MUSIC_ACCESS_TOKEN}" "$BASE/api/library" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('ok') is True, d
fav = (d.get('data') or {}).get('favorites') or []
print('library ok fav=', len(fav))
assert len(fav) >= 1, 'favorites empty — check D1 restore'
"
else
  echo "skip library (no MUSIC_ACCESS_TOKEN in env)"
fi

echo "==> favs export (CF Access or open; must not 5xx)"
code=$(curl -sS -A "$UA" -o /tmp/smoke-favs.body -w '%{http_code}' "$BASE/favs" || true)
echo "favs HTTP $code"
# 200 = open export JSON; 302/401/403 = Access login wall — all fine
case "$code" in
  200|301|302|303|307|308|401|403) ;;
  *)
    echo "unexpected favs status $code"
    head -c 200 /tmp/smoke-favs.body || true
    exit 1
    ;;
esac
if [[ "$code" == "200" ]]; then
  python3 -c "
import json
d=json.load(open('/tmp/smoke-favs.body'))
assert 'favorites' in d or d.get('ok') is False
print('favs body keys', list(d.keys())[:6])
"
fi

echo "smoke-prod OK"
