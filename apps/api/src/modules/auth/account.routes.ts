import {and, count, eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {z} from 'zod';
import {parseJson} from '../../core/http.ts';
import {passkeys} from '../../db/schema/index.ts';
import type {AuthContext} from './auth.context.ts';

/** Recovery-code sign-in, and management of the signed-in account's passkeys and codes. */
export const accountRoutes = ({db, limiter, sessions, recoveryCodes}: AuthContext) =>
    new Hono()
        .post('/recovery', async (c) => {
            await limiter.assertNotLocked(c);
            const {code} = await parseJson(c, z.object({code: z.string().min(1).max(64)}));
            const userId = await recoveryCodes.consume(code);
            if (!userId) return limiter.fail(c, 'Code de récupération invalide');
            await limiter.clear(c);
            await sessions.open(c, userId);
            return c.json({ok: true, remaining: await recoveryCodes.remaining(userId)});
        })
        .get('/passkeys', async (c) => {
            const {userId} = await sessions.require(c);
            const list = await db
                .select({
                    id: passkeys.id,
                    name: passkeys.name,
                    createdAt: passkeys.createdAt,
                    lastUsedAt: passkeys.lastUsedAt,
                })
                .from(passkeys)
                .where(eq(passkeys.userId, userId))
                .orderBy(passkeys.createdAt);
            return c.json({passkeys: list, recoveryCodesRemaining: await recoveryCodes.remaining(userId)});
        })
        .delete('/passkeys/:id', async (c) => {
            const {userId} = await sessions.require(c);
            const [{n}] = await db.select({n: count()}).from(passkeys).where(eq(passkeys.userId, userId));
            if (n <= 1) {
                throw new HTTPException(409, {
                    message: 'Impossible de supprimer la dernière passkey : ajoute d’abord un autre appareil.',
                });
            }
            const deleted = await db
                .delete(passkeys)
                .where(and(eq(passkeys.id, c.req.param('id')), eq(passkeys.userId, userId)))
                .returning({id: passkeys.id});
            if (!deleted.length) throw new HTTPException(404, {message: 'Passkey introuvable'});
            return c.json({ok: true});
        })
        .post('/recovery-codes', async (c) => {
            const {userId} = await sessions.require(c);
            return c.json({recoveryCodes: await recoveryCodes.issue(userId)});
        });
