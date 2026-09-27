#!/bin/sh
# Post-deploy smoke check through the public entrypoint (Caddy):
# the web app renders, the API answers, and internal health endpoints are not exposed.
set -eu
cd "$(dirname "$0")"

base=$(grep -E '^PUBLIC_WEB_URL=' .env.prod | cut -d= -f2-)
[ -n "$base" ] || { echo "smoke: PUBLIC_WEB_URL missing in .env.prod" >&2; exit 2; }

curl_opts="-sS -o /dev/null -w %{http_code} --max-time 10"
[ "${SMOKE_INSECURE:-0}" = "1" ] && curl_opts="$curl_opts -k"

expect() {
  # $1 path, $2 expected status
  # shellcheck disable=SC2086 # curl_opts is intentionally word-split
  status=$(curl $curl_opts "$base$1" || echo 000)
  if [ "$status" != "$2" ]; then
    echo "smoke: $1 returned $status, expected $2" >&2
    return 1
  fi
  echo "smoke: $1 -> $status"
}

expect /sign-in 200
expect /api/capabilities 401
expect /healthz 404
