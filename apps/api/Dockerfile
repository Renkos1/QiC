# syntax=docker/dockerfile:1.7
# Build context: repository root.  docker build -f apps/api/Dockerfile .
# Base images are pinned by digest; Renovate bumps tag and digest together.
# The build stage needs glibc (the TypeScript 7 native compiler has no musl build);
# the runtime is Alpine because production dependencies are pure JavaScript.
ARG BUILD_IMAGE=node:24.21.0-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe
ARG RUNTIME_IMAGE=node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

FROM ${BUILD_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Reduce the monorepo to @qic/api and its workspace dependencies.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.3 prune @qic/api --docker

FROM base AS builder
# Manifests first so the dependency layer is cached until a package.json or the lockfile changes.
COPY --from=pruner /repo/out/json/ .
# turbo prune omits the pnpmfile, but the lockfile pins its checksum.
COPY .pnpmfile.cjs ./
# Dependency lifecycle scripts are all denied (pnpm-workspace allowBuilds); skipping them
# also skips the root "prepare" hook installer, which needs a git checkout.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@qic/api
# Standalone production node_modules; --legacy because workspace packages are linked, not injected.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @qic/api deploy --prod --legacy --ignore-scripts /out

FROM ${RUNTIME_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Files stay root-owned and the process runs as "node", so the app cannot modify its own code.
COPY --from=builder /out/package.json ./package.json
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/dist ./dist
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}
ENV PORT=4000
EXPOSE 4000
USER node
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/healthz > /dev/null || exit 1
CMD ["node", "--enable-source-maps", "--import", "./dist/instrument.js", "dist/main.js"]
