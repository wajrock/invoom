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

To test on a phone, use an HTTPS tunnel (e.g. `cloudflared tunnel --url http://localhost:4200`): passkeys require `localhost` or HTTPS.

## Scripts

| Command          | What it does                              |
| ---------------- | ----------------------------------------- |
| `pnpm dev`       | API and web app in watch mode             |
| `pnpm build`     | Production build of the web app           |
| `pnpm test`      | Unit tests                                |
| `pnpm typecheck` | TypeScript checks for both apps           |
| `pnpm lint`      | ESLint (formatting included) and Prettier |
| `pnpm lint:fix`  | Fix lint and formatting issues            |
| `pnpm check`     | lint + typecheck + test                   |

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

## Deployment

A single Docker image serves the API and the web app. See [docs/deployment.md](docs/deployment.md).

## Contributing

Run `pnpm check` before opening a pull request. Code, comments and docs are in English; the interface is in French.
