import {z} from 'zod';

const schema = z.object({
    DATABASE_URL: z.url({protocol: /^postgres(ql)?$/, error: 'DATABASE_URL doit être une URL postgres://…'}),
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
        ),
    /** Sign-up and recovery emails, e.g. smtps://user:password@smtp.provider.com:465 */
    SMTP_URL: z.string().url().optional(),
    MAIL_FROM: z.string().default('Invoom <no-reply@localhost>'),
    PORT: z.coerce.number().default(3333),
    TRUST_PROXY: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
    STATIC_DIR: z.string().default('../web/dist/web/browser'),
    NODE_ENV: z.string().default('development'),
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
export const databaseUrl = resolveDatabaseUrl(env.DATABASE_URL, env.DATABASE_USER, env.DATABASE_PASSWORD);
export const isProd = env.NODE_ENV === 'production';
