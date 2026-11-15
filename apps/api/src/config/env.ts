import {z} from 'zod';

const schema = z
    .object({
        /**
         * Local demo mode (`pnpm dev:demo`): in-process database stored in apps/api/.demo, a fictitious account
         * signed in without passkey. Development only: refused in production.
         */
        INVOOM_DEMO: z
            .enum(['true', 'false'])
            .default('false')
            .transform((v) => v === 'true'),
        DATABASE_URL: z
            .url({protocol: /^postgres(ql)?$/, error: 'DATABASE_URL doit être une URL postgres://…'})
            .optional(),
        /**
         * Credentials overriding those of DATABASE_URL (same host and database). On Northflank the
         * POSTGRES_URI user can't create schemas, so migrations need the admin credentials.
         */
        DATABASE_USER: z.string().min(1).optional(),
        DATABASE_PASSWORD: z.string().min(1).optional(),
        ENCRYPTION_KEY: z
            .string()
            .refine(
                (v) => Buffer.from(v, 'base64').length === 32,
                'ENCRYPTION_KEY doit faire 32 octets en base64 (pnpm gen-key)',
            )
            .optional(),
        /** Sign-up and recovery emails, e.g. smtps://user:password@smtp.provider.com:465 */
        SMTP_URL: z.string().url().optional(),
        MAIL_FROM: z.string().default('Invoom <no-reply@localhost>'),
        PORT: z.coerce.number().default(3333),
        TRUST_PROXY: z
            .enum(['true', 'false'])
            .default('false')
            .transform((v) => v === 'true'),
        /** Built web app to serve (set by the Docker image). In development the Angular dev server serves it. */
        STATIC_DIR: z.string().min(1).optional(),
        NODE_ENV: z.string().default('development'),
    })
    .superRefine((v, ctx) => {
        if (v.INVOOM_DEMO) {
            if (v.NODE_ENV === 'production')
                ctx.addIssue({
                    code: 'custom',
                    path: ['INVOOM_DEMO'],
                    message: 'le mode démo est interdit en production',
                });
            return;
        }
        if (!v.DATABASE_URL) ctx.addIssue({code: 'custom', path: ['DATABASE_URL'], message: 'requis'});
        if (!v.ENCRYPTION_KEY) ctx.addIssue({code: 'custom', path: ['ENCRYPTION_KEY'], message: 'requis'});
    });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('Configuration invalide :');
    for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    process.exit(1);
}

export const env = parsed.data;

/** DATABASE_URL with DATABASE_USER / DATABASE_PASSWORD applied when set. */
export function resolveDatabaseUrl(base: string, user?: string, password?: string): string {
    if (!user && !password) return base;
    const url = new URL(base);
    if (user) url.username = encodeURIComponent(user);
    if (password) url.password = encodeURIComponent(password);
    return url.toString();
}
/** Empty in demo mode, which uses a local database instead. */
export const databaseUrl = env.DATABASE_URL
    ? resolveDatabaseUrl(env.DATABASE_URL, env.DATABASE_USER, env.DATABASE_PASSWORD)
    : '';
export const isProd = env.NODE_ENV === 'production';
