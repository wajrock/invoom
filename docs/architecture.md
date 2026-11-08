# Architecture

Invoom is a pnpm monorepo with two applications:

| App           | Path       | Stack                                                        |
| ------------- | ---------- | ------------------------------------------------------------ |
| `@invoom/web` | `apps/web` | Angular 22 (standalone, signals), Tailwind 4, spartan-ng UI  |
| `@invoom/api` | `apps/api` | Node 24 running TypeScript directly, Hono, Drizzle, Postgres |

In production the API serves the compiled web app, so a single container exposes everything on one origin.

## API (`apps/api/src`)

```
main.ts                 entry point: migrations, isolation setup, HTTP server
app.ts                  security headers, CSRF origin check, routing, static files
config/env.ts           validated environment variables
core/                   crypto (AES-256-GCM), HTTP helpers, mailer, shared validation
db/
  client.ts             Postgres client and migrations
  schema/               Drizzle tables: accounts.ts, workspace-data.ts
  workspace-scope.ts    per-request workspace transaction (see "Data isolation")
modules/<feature>/      one folder per domain
  *.routes.ts           Hono routes
  *.schema.ts           zod input schemas and types
  *.store.ts            data access shared with other modules
  *.service.ts / *.defaults.ts
scripts/access-link.ts  admin tool: one-time access link for an account
drizzle/                SQL migrations (generated, then hand-edited for RLS)
```

Modules: `auth`, `clients`, `company`, `dashboard`, `deadlines`, `fiscal` (pure tax rules), `invoices` (numbering, totals, PDF), `payments` (and uploaded files), `platforms`, `services`, `settings`, `simulator` (net after charges, or amount to invoice for a target net).

### Request lifecycle

1. `secureHeaders` sets a strict CSP; state-changing `/api/*` requests must come from the same origin.
2. `/api/auth/*` routes are public (sign-up, sign-in, recovery) or check the session themselves.
3. Every other `/api/*` route goes through `requireAuth`, which loads the session and runs the rest of the request inside its workspace scope.
4. Errors thrown as `HTTPException` become `{error: message}` JSON; anything else is logged and returns 500.

### Data isolation

All business data (clients, payments, invoices, settings…) belongs to a **workspace**. A user owns one workspace today; the model allows inviting members later.

Isolation does not rely on queries remembering a filter:

- Business tables have Postgres **row-level security** (`FORCE ROW LEVEL SECURITY`) with a policy matching `workspace_id` to `current_setting('app.workspace_id')`. Without that setting no row is visible, and writing a row for another workspace is rejected.
- `workspace_id` defaults to the same setting, so inserts don't pass it explicitly.
- Each request runs in a transaction that sets `app.workspace_id` and switches to the `invoom_app` role, which cannot bypass RLS even when the connection uses an admin account. The server refuses to start if it would bypass RLS without that role.
- Route factories receive `scopedDeps`: proxies that resolve, at call time, to the current request's transaction and the workspace's cipher (`AsyncLocalStorage`).

Adding a business table means: a `workspaceId()` column, an RLS policy plus `FORCE` in the migration, and an entry in `WORKSPACE_TABLES`. Upserts must target `(workspace_id, …)`.

### Encryption

Business payloads are stored encrypted (AES-256-GCM) in `bytea` columns; only fields needed for sorting or filtering (dates) stay in clear. Each workspace has its own data key, encrypted with the master `ENCRYPTION_KEY`.

### Authentication

Passwordless:

- **Sign-up**: email → one-time link (30 min) → passkey creation → recovery codes.
- **Sign-in**: discoverable WebAuthn passkeys (`@simplewebauthn/server`), user verification required.
- **Recovery**: 10 single-use recovery codes (80 random bits each), or an emailed link to register a new passkey.
- Sessions are random tokens stored as SHA-256, in an `HttpOnly`, `SameSite=Strict` cookie (`__Host-` prefixed in production), valid 7 days.
- Failed attempts lock the IP progressively (15 min doubling to 24 h) with a global cap; outgoing emails are throttled per address and per IP. Sign-up and recovery answer identically whether or not an account exists.

### Invoices and tax rules

- `modules/invoices`: chronological numbering (`YYYY-NNN`, serialized with an advisory lock), totals, French and optional English PDF (pdfkit, embedded Geist font). Issued invoices keep a frozen copy of the client.
- `modules/fiscal`: French micro-entrepreneur rules. Rates are dated periods; each payment uses the period in force when it was received. Generates URSSAF, CFE and income tax deadlines, moved to the next business day.

## Web (`apps/web/src/app`)

```
core/        app-wide services: auth (service, guards, interceptor), theme, HTTP error helper
shared/      reusable UI components, pipes and utilities
layout/      application shell: sidebar (desktop), tab bar and "Plus" sheet (mobile)
features/    one folder per domain (auth, dashboard, payments, invoices, clients, services,
             deadlines, simulator, platforms, company, settings) with pages, dialogs and data access
```

- `libs/ui` contains the vendored spartan-ng "helm" components (imported as `@spartan-ng/helm/*`).
- Routes are lazy-loaded per feature (`app.routes.ts`).
- The menu is defined once in `layout/nav.ts`: titled sections (Activité, Facturation, Outils), and Paramètres with its own tabs (Entreprise, Fiscalité, Sécurité under `/parametres/*`). Menu labels are reused as tab titles.
- On screens under 640 px, dialogs become bottom sheets and primary actions become floating buttons.

## Conventions

- Code, comments and docs in English; user-facing text in French.
- Money in integer cents; dates as `YYYY-MM-DD` strings.
- Prettier (4 spaces, no bracket spacing, semicolons, width 120) enforced through ESLint.
