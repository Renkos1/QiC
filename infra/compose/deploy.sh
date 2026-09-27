#!/bin/sh
# Deploys pinned images to this server and rolls back automatically if they do not
# come up healthy or fail the smoke check. Runs on the server (POSIX sh + docker).
#
#   ./deploy.sh <api-image> <worker-image> <web-image>
#   e.g. ./deploy.sh registry/qic-api@sha256:... registry/qic-worker@sha256:... registry/qic-web@sha256:...
#
# Env: SKIP_PULL=1 for images that exist only locally (rehearsal),
#      SMOKE_INSECURE=1 to accept Caddy's internal certificate (SITE_ADDRESS=localhost).
set -eu

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <api-image> <worker-image> <web-image>" >&2
  exit 2
fi

cd "$(dirname "$0")"
[ -f .env.prod ] || { echo "missing .env.prod (copy .env.prod.example)" >&2; exit 2; }

compose() {
  docker compose -f docker-compose.prod.yml --env-file .env.prod --env-file .env.images "$@"
}

# Keep what is running now so a failed deploy can return to it.
if [ -f .env.images ]; then
  cp .env.images .env.images.previous
fi

printf 'API_IMAGE=%s\nWORKER_IMAGE=%s\nWEB_IMAGE=%s\n' "$1" "$2" "$3" > .env.images.next
mv .env.images.next .env.images

if [ "${SKIP_PULL:-0}" != "1" ]; then
  compose pull api worker web
fi

# Migrations are expand/contract (docs/runbooks/database-migrations.md), so the previous
# images keep working on the new schema and rollback never touches the database.
if compose up -d --remove-orphans --wait --wait-timeout 180 && ./smoke.sh; then
  echo "deploy: OK"
  exit 0
fi

echo "deploy: FAILED, rolling back" >&2
if [ -f .env.images.previous ]; then
  ./rollback.sh
else
  echo "deploy: no previous release to roll back to" >&2
fi
exit 1
