import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { createDb } from './db/client.ts';
import { env, isProd } from './env.ts';
import { createCipher } from './lib/crypto.ts';

const { db, sql, migrate } = createDb(env.DATABASE_URL);
await migrate();

const app = createApp(
  { db, cipher: createCipher(env.ENCRYPTION_KEY) },
  {
    accessCodeHash: env.ACCESS_CODE_HASH,
    secureCookies: isProd,
    trustProxy: env.TRUST_PROXY,
    staticDir: env.STATIC_DIR,
  },
);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Freelance Hub prêt sur http://localhost:${info.port}`);
});

const shutdown = () => {
  server.close();
  void sql.end({ timeout: 5 });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
