import {eq} from 'drizzle-orm';
import {Hono, type Context} from 'hono';
import {z} from 'zod';
import {parseJson} from '../../core/http.ts';
import {users} from '../../db/schema/index.ts';
import {MAIL_PER_ADDRESS, MAIL_PER_IP} from './auth.config.ts';
import type {AuthContext} from './auth.context.ts';
import {emailBody} from './auth.schemas.ts';
import {relyingParty} from './request.ts';

/**
 * Sign-up and recovery links. Both answer the same whether or not the address has an account,
 * so the endpoints can't be used to find out who is registered.
 */
export const emailLinkRoutes = ({db, ip, limiter, emailLinks}: AuthContext) => {
    async function readEmail(c: Context) {
        const {email} = await parseJson(c, emailBody);
        await limiter.throttle(`mail-ip:${ip(c)}`, MAIL_PER_IP);
        await limiter.throttle(`mail:${email}`, MAIL_PER_ADDRESS);
        const [user] = await db.select({id: users.id}).from(users).where(eq(users.email, email));
        return {email, userId: user?.id ?? null};
    }

    return new Hono()
        .post('/signup', async (c) => {
            const {email, userId} = await readEmail(c);
            // An existing account gets an access link instead of a second account
            await emailLinks.send(relyingParty(c).origin, userId ? 'recover' : 'signup', email, userId);
            return c.json({ok: true});
        })
        .post('/recover', async (c) => {
            const {email, userId} = await readEmail(c);
            if (userId) await emailLinks.send(relyingParty(c).origin, 'recover', email, userId);
            return c.json({ok: true});
        })
        .post('/token', async (c) => {
            await limiter.assertNotLocked(c);
            const {token} = await parseJson(c, z.object({token: z.string().min(1).max(128)}));
            const link = await emailLinks.findByToken(token);
            if (!link) return limiter.fail(c, 'Lien invalide ou expiré. Demande un nouveau lien.');
            return c.json({purpose: link.purpose, email: link.email});
        });
};
