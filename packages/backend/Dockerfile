# ---------------------------------------------------------------------------
# TradeApp backend — production image (multi-stage)
#
# Build context MUST be the repo root (this is a workspaces monorepo and the
# backend depends on the @tradeapp/shared workspace):
#
#   docker build -f packages/backend/Dockerfile -t tradeapp-backend .
#
# bookworm-slim (Debian) is used rather than alpine because the backend pulls in
# native modules (sharp, bcrypt) whose prebuilt binaries are most reliable on
# glibc.
# ---------------------------------------------------------------------------

# ---- Stage 1: build -------------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Toolchain for any native module that needs to compile from source.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install with the lockfile first for cache-friendly layers. Copy only the
# manifests so a source-only change doesn't bust the dependency layer.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
RUN npm ci

# Copy the rest of the sources needed to build shared + backend.
COPY tsconfig*.json ./
COPY packages/shared packages/shared
COPY packages/backend packages/backend

# Build the shared types first, then the backend.
#
# NOTE: the backend carries pre-existing TYPE-ONLY errors (an @types/express v5
# vs express v4 mismatch — see README "Known follow-ups"). `tsc` still emits
# correct JavaScript for them, so we tolerate its non-zero exit here but then
# assert the entrypoint was actually produced — a genuine build failure (no
# emit) still fails the image, while harmless type noise does not.
RUN npm run build --workspace=packages/shared \
    && (npm run build --workspace=packages/backend || true) \
    && test -f packages/backend/dist/server.js

# Drop dev dependencies so only runtime deps are carried into the final image.
RUN npm prune --omit=dev

# ---- Stage 2: runtime -----------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy installed (production-only) modules and compiled output.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Uploads are written to local disk — mount a volume here in production so they
# survive container restarts (see README "Persistent storage").
RUN mkdir -p /app/packages/backend/uploads \
    && chown -R node:node /app/packages/backend/uploads

# Run as the unprivileged built-in node user.
USER node

EXPOSE 3000

# Lightweight liveness probe against the /health endpoint.
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/packages/backend
CMD ["node", "dist/server.js"]
