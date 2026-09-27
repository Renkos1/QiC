#!/bin/sh
# Returns to the images recorded before the last deploy (.env.images.previous).
# The database is not rolled back: migrations are backward compatible by policy.
set -eu
cd "$(dirname "$0")"

[ -f .env.images.previous ] || { echo "rollback: no .env.images.previous" >&2; exit 2; }

cp .env.images .env.images.failed
cp .env.images.previous .env.images

docker compose -f docker-compose.prod.yml --env-file .env.prod --env-file .env.images \
  up -d --remove-orphans --wait --wait-timeout 180
./smoke.sh
echo "rollback: OK (failed images kept in .env.images.failed)"
