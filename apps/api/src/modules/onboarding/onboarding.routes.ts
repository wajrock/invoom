import {eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {parseJson} from '../../core/http.ts';
import {workspaces as workspaceTable} from '../../db/schema/index.ts';
import {scopedDeps} from '../../db/workspace-scope.ts';
import type {AuthContext} from '../auth/auth.context.ts';
import {applyOnboarding} from './onboarding.ts';
import {onboardingSchema} from './onboarding.schema.ts';

/**
 * First-run setup of a new workspace. Under /api/auth with the session routes: the flag lives on the workspace
 * (account tables, root connection), the answers in the workspace's encrypted settings.
 */
export const onboardingRoutes = ({db, sessions, workspaces}: AuthContext) =>
    new Hono().post('/onboarding', async (c) => {
        const session = await sessions.require(c);
        const [ws] = await db
            .select({onboarded: workspaceTable.onboarded})
            .from(workspaceTable)
            .where(eq(workspaceTable.id, session.workspaceId));
        // Done once: afterwards the details are edited in the settings, never overwritten from here
        if (ws?.onboarded) return c.json({error: 'Espace déjà configuré'}, 409);

        const body = await parseJson(c, onboardingSchema);
        await workspaces.run(session, () => applyOnboarding(scopedDeps, body));
        // After the workspace transaction has committed, on the root connection that owns the account tables
        await db.update(workspaceTable).set({onboarded: true}).where(eq(workspaceTable.id, session.workspaceId));
        return c.json({ok: true});
    });
