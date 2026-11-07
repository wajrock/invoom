# Deployment

Invoom ships as a single Docker image (`Dockerfile` at the repository root): the Angular build is served by the API, and database migrations run on startup.

## Requirements

- A Postgres 15+ database.
- An SMTP account for sign-up and recovery emails (e.g. Brevo, Resend, Postmark).
- HTTPS: passkeys only work on `localhost` or a secure origin.

## Environment variables

| Variable                              | Required | Description                                                                                                   |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | yes      | `postgres://…` connection string                                                                              |
| `DATABASE_USER` / `DATABASE_PASSWORD` | no       | Override the credentials of `DATABASE_URL` (Northflank: the addon's admin credentials, needed for migrations) |
| `ENCRYPTION_KEY`                      | yes      | 32-byte base64 master key. **Never change it** once data exists                                               |
| `SMTP_URL`                            | yes\*    | e.g. `smtps://user:password@smtp-relay.brevo.com:465`. Without it, emails are only printed to the logs        |
| `MAIL_FROM`                           | yes\*    | Sender, e.g. `Invoom <no-reply@your-domain>`                                                                  |
| `TRUST_PROXY`                         | no       | `true` behind a reverse proxy, to read the client IP from `X-Forwarded-For`                                   |
| `PORT`                                | no       | Defaults to `3333`                                                                                            |

\* Required to open sign-ups: without SMTP, users can't receive their sign-up or recovery links.

`NODE_ENV=production` and `STATIC_DIR` are set by the image.

Generate a key with `pnpm --filter @invoom/api gen-key`.

## Database role

Row-level security is enforced through a restricted `invoom_app` role that the migrations create (`CREATE ROLE invoom_app NOLOGIN; GRANT invoom_app TO <connection user>`). If the database user cannot create roles, create it once manually with an admin account. The API refuses to start when it would bypass row-level security without this role.

## Northflank

1. Create a **Postgres addon** and a **combined service** built from the `Dockerfile`.
2. Link the addon's `POSTGRES_URI` to `DATABASE_URL`, and `ADMIN_USERNAME` / `ADMIN_PASSWORD` to `DATABASE_USER` / `DATABASE_PASSWORD`.
3. Add `ENCRYPTION_KEY`, `SMTP_URL`, `MAIL_FROM` and `TRUST_PROXY=true` as secrets.
4. Expose port `3333` over HTTP and attach your domain (a `CNAME` to the Northflank target; apex domains need ALIAS/CNAME flattening).

## Email deliverability

Before opening sign-ups, add the SPF and DKIM records given by your SMTP provider to your domain's DNS, and send from an address on that domain.

## Migrating data from before accounts existed

The accounts migration moves existing data into a legacy workspace. Its owner claims it once, from a shell in the running container:

```bash
node scripts/enroll.ts --email you@example.com https://your-domain
```

This creates the account, attaches the legacy workspace and prints a one-time link to create a passkey. The same command gives a user an access link as a last resort.
