import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {Hono} from 'hono';
import {cors} from 'hono/cors';
import type {ApiCall} from './mcp.shared.ts';
import {createMcpServer} from './mcp.tools.ts';
import {publicOrigin} from './oauth.routes.ts';
import type {AgentIdentity, OAuthStore} from './oauth.store.ts';

/** Runs a business API request in-process as the agent (see requireAuth): never reachable from outside */
export type InternalRequest = (path: string, init: RequestInit, agent: AgentIdentity) => Promise<Response>;

/** Same host on both headers, as the same-origin check of state-changing requests expects */
const INTERNAL_HEADERS = {
    'content-type': 'application/json',
    origin: 'http://invoom.internal',
    host: 'invoom.internal',
};

/**
 * MCP endpoint (Streamable HTTP, stateless: a new server per request). Needs an OAuth access token; without one,
 * the 401 points the agent at the metadata from which it discovers how to sign in.
 */
export function mcpRoutes(store: OAuthStore, internal: InternalRequest, trustForwarded: boolean) {
    const app = new Hono();
    app.use('/mcp', cors({origin: '*', exposeHeaders: ['mcp-session-id', 'www-authenticate']}));

    app.all('/mcp', async (c) => {
        const token = /^Bearer (.+)$/i.exec(c.req.header('authorization') ?? '')?.[1];
        const agent = token ? await store.verifyAccessToken(token) : null;
        if (!agent) {
            const metadata = `${publicOrigin(c, trustForwarded)}/.well-known/oauth-protected-resource/mcp`;
            c.header('WWW-Authenticate', `Bearer resource_metadata="${metadata}"`);
            // Charset spelled out: opened in a browser, the French message would otherwise show as "Ã "
            return c.json({error: 'invalid_token', error_description: 'Connexion à Invoom requise'}, 401, {
                'Content-Type': 'application/json; charset=utf-8',
            });
        }

        const api: ApiCall = async (method, path, body) => {
            const res = await internal(
                path,
                {method, headers: INTERNAL_HEADERS, body: body === undefined ? undefined : JSON.stringify(body)},
                agent,
            );
            if (!res.ok) {
                const err = (await res.json().catch(() => null)) as {error?: string} | null;
                throw new Error(err?.error ?? `Erreur ${res.status}`);
            }
            return (res.status === 204 ? null : await res.json()) as never;
        };

        const server = createMcpServer(api);
        const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        await server.connect(transport);
        return transport.handleRequest(c.req.raw);
    });

    return app;
}
