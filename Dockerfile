# syntax=docker/dockerfile:1
# Image de production : front Angular compilé + API Node (TypeScript exécuté directement par Node 24)

# ── 1. Build du front ────────────────────────────────────────────────────────
FROM node:24-alpine AS client
WORKDIR /app/client
RUN corepack enable
COPY client/package.json client/pnpm-lock.yaml client/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY client/ ./
RUN pnpm build

# ── 2. Dépendances de production du serveur ─────────────────────────────────
FROM node:24-alpine AS server-deps
WORKDIR /app/server
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ── 3. Image finale ─────────────────────────────────────────────────────────
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3333 \
    STATIC_DIR=/app/client/dist/client/browser
WORKDIR /app/server
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY server/drizzle ./drizzle
COPY server/assets ./assets
COPY --from=client /app/client/dist/client/browser /app/client/dist/client/browser
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
# Les migrations de base de données s'appliquent au démarrage
CMD ["node", "src/index.ts"]
