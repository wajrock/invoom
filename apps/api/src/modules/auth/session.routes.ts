import {eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {users} from '../../db/schema/index.ts';
import {scopedDeps} from '../../db/workspace-scope.ts';
import {getCompany} from '../company/company.store.ts';
import type {AuthContext} from './auth.context.ts';

export const sessionRoutes = ({db, sessions, workspaces}: AuthContext) =>
    new Hono()
        .get('/me', async (c) => {
            const session = await sessions.current(c);
            if (!session) return c.json({authenticated: false, email: null});
            const [user] = await db.select({email: users.email}).from(users).where(eq(users.id, session.userId));
            return c.json({authenticated: true, email: user?.email ?? null, expiresAt: session.expiresAt});
        })
        /** Signed-in account as the menu shows it: its business name (encrypted, read in the workspace) and email */
        .get('/account', async (c) => {
            const session = await sessions.require(c);
            const [user] = await db.select({email: users.email}).from(users).where(eq(users.id, session.userId));
            const company = await workspaces.run(session, () => getCompany(scopedDeps));
            const name = company.fields.find((f) => f.id === 'name')?.value.trim() ?? '';
            return c.json({email: user?.email ?? '', name});
        })
        .post('/logout', async (c) => {
            await sessions.close(c);
            return c.json({ok: true});
        });
