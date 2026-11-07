import {serve} from '@hono/node-server';
import {createApp} from './app.ts';
import {createDb} from './db/client.ts';
import {databaseUrl, env, isProd} from './config/env.ts';
import {createWorkspaceRuntime} from './db/workspace-scope.ts';
import {createCipher} from './core/crypto.ts';
import {createMailer} from './core/mailer.ts';

const {db, sql, migrate} = createDb(databaseUrl);
await migrate();
const workspaces = await createWorkspaceRuntime(db, createCipher(env.ENCRYPTION_KEY));
if (isProd && !env.SMTP_URL) console.warn('SMTP_URL is not set: sign-up and recovery emails will not be sent.');

const app = createApp(db, {
    workspaces,
    mailer: createMailer({smtpUrl: env.SMTP_URL, from: env.MAIL_FROM}),
    secureCookies: isProd,
    trustProxy: env.TRUST_PROXY,
    staticDir: env.STATIC_DIR,
});

const server = serve({fetch: app.fetch, port: env.PORT}, (info) => {
    console.info(`Invoom API listening on http://localhost:${info.port}`);
});

const shutdown = () => {
    server.close();
    void sql.end({timeout: 5});
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
