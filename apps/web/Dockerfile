# syntax=docker/dockerfile:1.7
# Build context: repository root.  docker build -f apps/web/Dockerfile .
# Base images are pinned by digest; Renovate bumps tag and digest together.
ARG BUILD_IMAGE=node:24.21.0-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe
ARG RUNTIME_IMAGE=node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

FROM ${BUILD_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Reduce the monorepo to @qic/web and its workspace dependencies.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.3 prune @qic/web --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
# turbo prune omits the pnpmfile, but the lockfile pins its checksum.
COPY .pnpmfile.cjs ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY --from=pruner /repo/out/full/ .
# Browser code is compiled with these values; empty ones leave the feature off.
ARG GIT_SHA=dev
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_OTEL_BROWSER=""
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""
ENV NEXT_PUBLIC_RELEASE=${GIT_SHA}
# Next "standalone" output traces exactly the files the server needs, node_modules included.
# A non-empty sentry_auth_token secret uploads source maps; being a secret, it never lands in a layer.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm turbo run build --filter=@qic/web

FROM ${RUNTIME_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
# outputFileTracingRoot is the repo root, so the server lives at apps/web/server.js.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}
EXPOSE 3000
USER node
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null || exit 1
CMD ["node", "apps/web/server.js"]
