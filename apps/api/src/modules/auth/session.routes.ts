import {eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {users} from '../../db/schema/index.ts';
import type {AuthContext} from './auth.context.ts';

export const sessionRoutes = ({db, sessions}: AuthContext) =>
    new Hono()
        .get('/me', async (c) => {
            const session = await sessions.current(c);
            if (!session) return c.json({authenticated: false, email: null});
            const [user] = await db.select({email: users.email}).from(users).where(eq(users.id, session.userId));
            return c.json({authenticated: true, email: user?.email ?? null, expiresAt: session.expiresAt});
        })
        .post('/logout', async (c) => {
            await sessions.close(c);
            return c.json({ok: true});
        });
