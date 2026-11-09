# AGENTS.md

Guidance for coding agents working on Invoom. Read [docs/architecture.md](docs/architecture.md) before structural changes.

## Commands

```bash
pnpm install
pnpm services            # Postgres + Mailpit via docker compose
pnpm dev                 # API :3333 + web :4200
pnpm check               # lint + typecheck + test: must pass before you finish
pnpm lint:fix            # auto-fix formatting and lint
pnpm --filter @invoom/api test
pnpm --filter @invoom/web build
pnpm --filter @invoom/api db:generate   # after editing apps/api/src/db/schema
```

## Layout

- `apps/api` — Hono API. Business code lives in `src/modules/<feature>/` (`*.routes.ts`, `*.schema.ts`, `*.store.ts`). Infrastructure is in `src/core` and `src/db`.
- `brand/` — logo, icons and colours; app icons in `apps/web/public` are copies of `brand/icon`.
- `apps/web` — Angular app. Business code lives in `src/app/features/<feature>/`; reusable UI goes in `src/app/shared`; `libs/ui` is the vendored spartan-ng UI kit.

## Rules

- **Data isolation is mandatory.** Business routes must use the `Deps` they receive (`scopedDeps`), never the root `db`. A new business table needs a `workspaceId()` column, a row-level security policy with `FORCE ROW LEVEL SECURITY` in its migration, and an entry in `WORKSPACE_TABLES`. Upserts target `(workspace_id, …)`.
- **Encrypt business data**: store payloads with `cipher.encryptJson` in `bytea` columns; keep only sortable/filterable fields (dates) in clear.
- **Migrations**: generate with drizzle-kit, then review and hand-edit the SQL (RLS, data backfills). Never edit a migration that has been deployed.
- **Money** is an integer number of cents; **dates** are `YYYY-MM-DD` strings computed in UTC.
- **Auth**: never weaken rate limiting, single-use tokens or the "same answer whether the account exists" behaviour of sign-up and recovery.
- **Language**: code, comments, commit messages and docs in English; user-facing text in French.
- **Comments** explain why, not what. Don't add comments that restate the code.
- **Style**: Prettier config at the root (4 spaces, no bracket spacing, semicolons, single quotes, width 120). Don't disable lint rules to make code pass.
- **Angular**: standalone components, signals, `@if/@for` control flow, `templateUrl` for templates over ~30 lines, files under ~250 lines. Reuse `shared/` components before creating new ones.
- **Navigation**: in-app links carry `appReplaceUrl` next to `routerLink`, and code navigates through `NavigationService`, never the router directly: the installed app must not stack history entries (the iOS edge swipe would go back through them).
- **Forms and details** open in the right drawer (`drawerOptions()` from `shared/ui/drawer`), full screen on phones; detail cards end with `app-detail-footer`.
- **Never commit** `.env` files, real invoices (`*.pdf` at the root) or database dumps.

## Verifying changes

- Run `pnpm check`.
- For UI changes, check both desktop and a 390 px wide viewport.
- For auth or isolation changes, exercise the flow with two accounts and confirm neither can read the other's data.
