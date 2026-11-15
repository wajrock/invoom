import {serve} from '@hono/node-server';
import {createApp} from './app.ts';
import {createDb, createLocalDb} from './db/client.ts';
import {databaseUrl, env, isProd} from './config/env.ts';
import {createWorkspaceRuntime} from './db/workspace-scope.ts';
import {createCipher} from './core/crypto.ts';
import {createMailer} from './core/mailer.ts';
import {DEMO_DIR, DEMO_EMAIL, DEMO_ENCRYPTION_KEY, ensureDemoAccount, seedDemo} from './demo/demo.ts';

const demoMode = env.INVOOM_DEMO;
const {db, close, migrate} = demoMode ? await createLocalDb(DEMO_DIR) : createDb(databaseUrl);
await migrate();
const encryptionKey = demoMode ? DEMO_ENCRYPTION_KEY : env.ENCRYPTION_KEY!;
const workspaces = await createWorkspaceRuntime(db, createCipher(encryptionKey));
if (isProd && !env.SMTP_URL) console.warn('SMTP_URL is not set: sign-up and recovery emails will not be sent.');

const demo = demoMode ? await ensureDemoAccount(db, workspaces) : undefined;

const app = createApp(db, {
    workspaces,
    mailer: createMailer({smtpUrl: env.SMTP_URL, from: env.MAIL_FROM}),
    secureCookies: isProd,
    trustProxy: env.TRUST_PROXY,
    staticDir: env.STATIC_DIR,
    devWebPort: isProd ? undefined : 4200,
    demo,
});

if (demo?.created) {
    console.info('Démo : création des données fictives…');
    // A half-seeded account would not be seeded again on the next start
    await seedDemo(app).catch(async (err: unknown) => {
        console.error(err);
        console.error('Démo incomplète : lance `pnpm demo:reset` puis redémarre.');
        await close();
        process.exit(1);
    });
}

const server = serve({fetch: app.fetch, port: env.PORT}, (info) => {
    console.info(`Invoom API listening on http://localhost:${info.port}`);
    if (demo) console.info(`Mode démo : connecté en ${DEMO_EMAIL}, données dans ${DEMO_DIR}`);
});

const shutdown = () => {
    server.close();
    void close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
