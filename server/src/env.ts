import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY doit faire 32 octets en base64 (pnpm gen-key)'),
  ACCESS_CODE_HASH: z.string().startsWith('$argon2', "ACCESS_CODE_HASH doit être une empreinte argon2 (pnpm hash-code)"),
  PORT: z.coerce.number().default(3333),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  STATIC_DIR: z.string().default('../client/dist/client/browser'),
  NODE_ENV: z.string().default('development'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
