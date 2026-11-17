import {Hono, type MiddlewareHandler} from 'hono';
import type {AgentIdentity} from '../agents/oauth.store.ts';
import {accountRoutes} from './account.routes.ts';
import {createAuthContext, type AuthOptions} from './auth.context.ts';
import {emailLinkRoutes} from './email-link.routes.ts';
import {passkeyLoginRoutes} from './passkey-login.routes.ts';
import {passkeyRegisterRoutes} from './passkey-register.routes.ts';
import {sessionRoutes} from './session.routes.ts';

export type {AuthOptions} from './auth.context.ts';

export function createAuth(opts: AuthOptions) {
    const ctx = createAuthContext(opts);

    /**
     * Requires a session, or an agent already authenticated by the MCP endpoint (passed in-process through the
     * request env, which no outside request can set); the rest of the request then runs inside its workspace.
     */
    const requireAuth: MiddlewareHandler = async (c, next) => {
        const agent = (c.env as {agent?: AgentIdentity} | undefined)?.agent;
        const session = agent ?? (await ctx.sessions.current(c));
        if (!session) return c.json({error: 'Non authentifié'}, 401);
        await opts.workspaces.run({workspaceId: session.workspaceId, userId: session.userId}, async () => {
            await next();
            // Roll the transaction back on route errors (app.onError then builds the response)
            if (c.error) throw c.error;
        });
    };

    const routes = new Hono()
        .route('/', sessionRoutes(ctx))
        .route('/', emailLinkRoutes(ctx))
        .route('/', passkeyLoginRoutes(ctx))
        .route('/', passkeyRegisterRoutes(ctx))
        .route('/', accountRoutes(ctx));

    return {routes, requireAuth, sessions: ctx.sessions};
}
