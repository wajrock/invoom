<p align="center">
    <img src="brand/social/readme-banner-light.png#gh-light-mode-only" alt="Invoom" width="100%">
    <img src="brand/social/readme-banner-dark.png#gh-dark-mode-only" alt="Invoom" width="100%">
</p>

# Invoom

Open-source back office for French freelancers (micro-entrepreneurs): bilingual invoices, client book, payments, and URSSAF, CFE and income tax deadlines, in one place.

- **Invoices** in French and optionally English from a single input, with the right VAT mention per client (franchise, EU reverse charge, outside the EU), chronological numbering and PDF generation.
- **Clients and services**: country-aware client records (SIREN, Italian SdI code, German VAT id…) and reusable invoice lines.
- **Payments**: track what is invoiced and received, attach PDFs.
- **Tax deadlines**: URSSAF declarations, CFE and income tax return, with estimated amounts from your rates.
- **Private by design**: passwordless sign-in with passkeys, data encrypted at rest with a key per workspace, strict per-workspace isolation enforced by Postgres.
- **Mobile-first**: installable web app with an app-like layout on phones.

## Stack

Angular 22 · Tailwind 4 · spartan-ng — Node 24 · Hono · Drizzle · Postgres · pdfkit · SimpleWebAuthn

See [docs/architecture.md](docs/architecture.md) for how it fits together.

## Getting started

Requirements: Node 24, pnpm 11 (`corepack enable`), Docker.

```bash
pnpm install
pnpm services                     # Postgres + Mailpit (docker compose)
cp apps/api/.env.example apps/api/.env
pnpm --filter @invoom/api gen-key # paste the output into ENCRYPTION_KEY in apps/api/.env
pnpm dev                          # API on :3333, web app on :4200
```

Open http://localhost:4200, create an account, and confirm it from the email caught by Mailpit at http://localhost:8025.

Always use http://localhost:4200 in development: the Angular dev server reloads the page on every change. The API on :3333 only answers `/api/*` and redirects other pages to :4200; it serves the built web app only in production (`STATIC_DIR`).

### Demo mode

To try a feature or a fix without Docker, account or passkey:

```bash
pnpm dev:demo   # API + web app with a fictitious account, already signed in
```

The database runs inside the API ([PGlite](https://pglite.dev), the same Postgres with the same migrations and row-level security) and is stored in `apps/api/.demo`. On first start it is filled with fictitious data (clients, invoices, payments, deadlines) dated relative to today. Every visit is signed in as `demo@invoom.local`, on any address. Without passkeys there is no need for HTTPS: a phone on the same Wi-Fi opens `http://<your computer's IP>:4200` (macOS: `ipconfig getifaddr en0`), and a tunnel (see below) works too. `pnpm demo:reset` deletes the folder: the next start creates fresh data. The API refuses this mode when `NODE_ENV=production`.

### Phone

To test on a phone, passkeys need `localhost` or HTTPS, so go through an HTTPS tunnel:

```bash
pnpm dev                                        # the dev server also accepts *.trycloudflare.com addresses
cloudflared tunnel --url http://localhost:4200  # in another terminal: prints the https://….trycloudflare.com address
```

With `pnpm dev:demo` the phone is signed in straight away, and the Wi-Fi address is enough. With your own account, sign in on the phone with "Appareil perdu ou nouvel appareil ?" (link by email, caught by Mailpit) or `pnpm --filter @invoom/api access-link --email you@example.com https://….trycloudflare.com`. A passkey belongs to one address: the tunnel gets a new one each time it starts.

## Scripts

| Command           | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `pnpm dev`        | API and web app in watch mode                  |
| `pnpm dev:demo`   | Same, with a fictitious account and local data |
| `pnpm demo:reset` | Delete the demo data (recreated on next start) |
| `pnpm build`      | Production build of the web app                |
| `pnpm test`       | Unit tests                                     |
| `pnpm typecheck`  | TypeScript checks for both apps                |
| `pnpm lint`       | ESLint (formatting included) and Prettier      |
| `pnpm lint:fix`   | Fix lint and formatting issues                 |
| `pnpm check`      | lint + typecheck + test                        |

Database migrations live in `apps/api/drizzle` and run automatically when the API starts. After changing `apps/api/src/db/schema`, run `pnpm --filter @invoom/api db:generate` and review the SQL (row-level security has to be added by hand, see the architecture notes).

## Repository layout

```
apps/
  api/        HTTP API, database, PDF generation, tax rules
  web/        Angular application
brand/        logo, icons, social images, colours and fonts
docs/         architecture and deployment notes
AGENTS.md     instructions for coding agents
```

## AI agents (MCP)

Invoom is an MCP server: an agent such as Claude can read the activity (revenue, expected income, simulations) and manage payments, invoices, clients, services and deadlines.

In Claude, add a custom connector with the address `https://<your domain>/mcp`. Claude opens an Invoom page where you approve it once with your passkey; the access lasts until you revoke it in Paramètres › Sécurité. Locally, `pnpm dev:demo` and a tunnel give a `https://….trycloudflare.com/mcp` address to try it.

## Deployment

A single Docker image serves the API and the web app. See [docs/deployment.md](docs/deployment.md).

## Contributing

Run `pnpm check` before opening a pull request. Code, comments and docs are in English; the interface is in French.
