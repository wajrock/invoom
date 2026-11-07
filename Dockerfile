# syntax=docker/dockerfile:1
# Production image: compiled Angular app served by the API (Node 24 runs TypeScript directly).

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY apps ./apps
RUN pnpm --filter @invoom/web build \
    && pnpm --filter @invoom/api deploy --prod /out/api

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3333 \
    STATIC_DIR=/app/web
WORKDIR /app/api
COPY --from=build /out/api ./
COPY --from=build /repo/apps/web/dist/web/browser /app/web
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
# Database migrations run on startup
CMD ["node", "src/main.ts"]
