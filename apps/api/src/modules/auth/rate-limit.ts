import {eq} from 'drizzle-orm';
import type {Context} from 'hono';
import {HTTPException} from 'hono/http-exception';
import type {Db} from '../../db/client.ts';
import {loginAttempts} from '../../db/schema/index.ts';
import {
    GLOBAL_LOCK_MS,
    GLOBAL_MAX_FAILURES,
    GLOBAL_WINDOW_MS,
    IP_BASE_LOCK_MS,
    IP_MAX_FAILURES,
    MAX_LOCK_MS,
} from './auth.config.ts';

const GLOBAL_KEY = '*';

export type RateLimiter = ReturnType<typeof createRateLimiter>;

export function createRateLimiter(db: Db, ipOf: (c: Context) => string) {
    async function lockedUntil(key: string): Promise<Date | null> {
        const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
        return row?.lockedUntil && row.lockedUntil > new Date() ? row.lockedUntil : null;
    }

    async function upsert(key: string, values: Omit<typeof loginAttempts.$inferInsert, 'key'>) {
        await db
            .insert(loginAttempts)
            .values({key, ...values})
            .onConflictDoUpdate({target: loginAttempts.key, set: values});
    }

    async function registerFailure(c: Context) {
        const ip = ipOf(c);
        const now = new Date();

        const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, ip));
        const failures = (row?.failures ?? 0) + 1;
        let lockouts = row?.lockouts ?? 0;
        let locked: Date | null = null;
        if (failures >= IP_MAX_FAILURES) {
            lockouts += 1;
            locked = new Date(now.getTime() + Math.min(IP_BASE_LOCK_MS * 2 ** (lockouts - 1), MAX_LOCK_MS));
        }
        await upsert(ip, {failures: locked ? 0 : failures, lockouts, lockedUntil: locked, windowStart: now});

        const [global] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, GLOBAL_KEY));
        const expired = !global || now.getTime() - global.windowStart.getTime() > GLOBAL_WINDOW_MS;
        const globalFailures = (expired ? 0 : global.failures) + 1;
        const globalLocked = globalFailures >= GLOBAL_MAX_FAILURES ? new Date(now.getTime() + GLOBAL_LOCK_MS) : null;
        await upsert(GLOBAL_KEY, {
            failures: globalLocked ? 0 : globalFailures,
            lockouts: 0,
            lockedUntil: globalLocked,
            windowStart: expired || globalLocked ? now : global.windowStart,
        });
    }

    return {
        async assertNotLocked(c: Context) {
            const lock = (await lockedUntil(ipOf(c))) ?? (await lockedUntil(GLOBAL_KEY));
            if (lock) {
                const minutes = Math.ceil((lock.getTime() - Date.now()) / 60000);
                throw new HTTPException(429, {message: `Trop de tentatives. Réessaie dans ${minutes} min.`});
            }
        },

        /** Counts the failure, then answers without revealing what was wrong. */
        async fail(c: Context, message = 'Authentification refusée'): Promise<never> {
            await registerFailure(c);
            throw new HTTPException(401, {message});
        },

        async clear(c: Context) {
            await db.delete(loginAttempts).where(eq(loginAttempts.key, ipOf(c)));
        },

        /** Fixed-window counter used for outgoing emails. */
        async throttle(key: string, {max, windowMs}: {max: number; windowMs: number}) {
            const now = new Date();
            const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
            const fresh = !row || now.getTime() - row.windowStart.getTime() > windowMs;
            const count = (fresh ? 0 : row.failures) + 1;
            if (count > max) throw new HTTPException(429, {message: 'Trop de demandes. Réessaie dans une heure.'});
            await upsert(key, {
                failures: count,
                lockouts: 0,
                lockedUntil: null,
                windowStart: fresh ? now : row.windowStart,
            });
        },
    };
}
