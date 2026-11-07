import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { createDb } from './db/client.ts';
import { databaseUrl, env, isProd } from './env.ts';
import { createWorkspaceRuntime } from './db/workspace.ts';
import { createCipher } from './lib/crypto.ts';
import { createMailer } from './lib/mailer.ts';

const { db, sql, migrate } = createDb(databaseUrl);
await migrate();
const workspaces = await createWorkspaceRuntime(db, createCipher(env.ENCRYPTION_KEY));
if (isProd && !env.SMTP_URL) console.warn('SMTP_URL absent : les e-mails (inscription, récupération) ne seront pas envoyés.');

const app = createApp(db, {
  workspaces,
  mailer: createMailer({ smtpUrl: env.SMTP_URL, from: env.MAIL_FROM }),
  secureCookies: isProd,
  trustProxy: env.TRUST_PROXY,
  staticDir: env.STATIC_DIR,
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Freelance Hub prêt sur http://localhost:${info.port}`);
});

const shutdown = () => {
  server.close();
  void sql.end({ timeout: 5 });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
