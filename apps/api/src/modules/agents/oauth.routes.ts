import {Hono, type Context} from 'hono';
import {cors} from 'hono/cors';
import {z} from 'zod';
import {isAllowedRedirectUri, type OAuthStore} from './oauth.store.ts';

/**
 * Public address of the app as the agent sees it (behind Northflank's proxy or a dev tunnel, the request itself
 * says http://internal-host). Forwarded headers are only trusted behind a known proxy, and in development.
 */
export function publicOrigin(c: Context, trustForwarded: boolean): string {
    const url = new URL(c.req.url);
    const proto =
        (trustForwarded && c.req.header('x-forwarded-proto')?.split(',')[0]?.trim()) || url.protocol.slice(0, -1);
    const host = (trustForwarded && c.req.header('x-forwarded-host')) || c.req.header('host') || url.host;
    return `${proto}://${host}`;
}

/** At most this many agent registrations an hour, whoever asks: registration needs no account */
const REGISTRATIONS_PER_HOUR = 30;

const registerSchema = z.object({
    redirect_uris: z.array(z.string().max(500)).min(1).max(5),
    client_name: z.string().trim().max(100).optional(),
});

const authorizeQuery = z.object({
    response_type: z.literal('code'),
    client_id: z.string().max(100),
    redirect_uri: z.string().max(500),
    code_challenge: z.string().min(43).max(128),
    code_challenge_method: z.literal('S256'),
    state: z.string().max(500).optional(),
});

const tokenSchema = z.discriminatedUnion('grant_type', [
    z.object({
        grant_type: z.literal('authorization_code'),
        code: z.string().max(200),
        redirect_uri: z.string().max(500),
        client_id: z.string().max(100),
        code_verifier: z.string().min(43).max(128),
    }),
    z.object({
        grant_type: z.literal('refresh_token'),
        refresh_token: z.string().max(200),
        client_id: z.string().max(100),
    }),
]);

const oauthError = (c: Context, error: string, description: string, status: 400 | 401 | 429 = 400) =>
    c.json({error, error_description: description}, status);

/**
 * OAuth 2.1 authorization server for agents (MCP clients), as the MCP authorization spec expects: metadata
 * discovery, dynamic client registration, authorization code with PKCE, rotating refresh tokens. The consent
 * itself happens in the web app (/autoriser), signed in with a passkey.
 */
export function oauthRoutes(store: OAuthStore, trustForwarded: boolean) {
    const origin = (c: Context) => publicOrigin(c, trustForwarded);
    const app = new Hono();

    // Agents call these from their servers, sometimes from a browser: no cookies involved, any origin
    app.use('/.well-known/*', cors());
    app.use('/oauth/*', cors());

    const resourceMetadata = (c: Context) =>
        c.json({
            resource: `${origin(c)}/mcp`,
            authorization_servers: [origin(c)],
            bearer_methods_supported: ['header'],
            scopes_supported: ['invoom'],
            resource_name: 'Invoom',
        });
    app.get('/.well-known/oauth-protected-resource', resourceMetadata);
    app.get('/.well-known/oauth-protected-resource/mcp', resourceMetadata);

    app.get('/.well-known/oauth-authorization-server', (c) => {
        const base = origin(c);
        return c.json({
            issuer: base,
            authorization_endpoint: `${base}/oauth/authorize`,
            token_endpoint: `${base}/oauth/token`,
            registration_endpoint: `${base}/oauth/register`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none'],
            scopes_supported: ['invoom'],
        });
    });

    app.post('/oauth/register', async (c) => {
        const body = registerSchema.safeParse(await c.req.json().catch(() => null));
        if (!body.success) return oauthError(c, 'invalid_client_metadata', 'redirect_uris requis');
        const uris = body.data.redirect_uris;
        if (!uris.every(isAllowedRedirectUri)) {
            return oauthError(c, 'invalid_redirect_uri', 'Adresse de retour en HTTPS (ou localhost) requise');
        }
        await store.pruneClients();
        if ((await store.registrationsSince(new Date(Date.now() - 3600_000))) >= REGISTRATIONS_PER_HOUR) {
            return oauthError(c, 'temporarily_unavailable', 'Trop d’enregistrements, réessaie plus tard', 429);
        }
        const name = body.data.client_name || new URL(uris[0]).hostname;
        const id = await store.registerClient(name, uris);
        return c.json(
            {
                client_id: id,
                client_name: name,
                redirect_uris: uris,
                token_endpoint_auth_method: 'none',
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
            },
            201,
        );
    });

    // Checks the request, then hands over to the consent page of the web app
    app.get('/oauth/authorize', async (c) => {
        const clientId = c.req.query('client_id') ?? '';
        const redirectUri = c.req.query('redirect_uri') ?? '';
        const client = await store.client(clientId);
        // Without a known client and one of its own addresses, the error cannot be sent back safely
        if (!client || !client.redirectUris.includes(redirectUri)) {
            return c.text('Application inconnue ou adresse de retour non enregistrée.', 400);
        }
        const query = authorizeQuery.safeParse(c.req.query());
        if (!query.success) {
            const back = new URL(redirectUri);
            back.searchParams.set('error', 'invalid_request');
            back.searchParams.set('error_description', 'PKCE (S256) et response_type=code requis');
            const state = c.req.query('state');
            if (state) back.searchParams.set('state', state);
            return c.redirect(back.toString());
        }
        return c.redirect(`/autoriser?${new URL(c.req.url).searchParams.toString()}`);
    });

    app.post('/oauth/token', async (c) => {
        const type = c.req.header('content-type') ?? '';
        const raw = type.includes('application/json')
            ? await c.req.json().catch(() => null)
            : Object.fromEntries(new URLSearchParams(await c.req.text()));
        const body = tokenSchema.safeParse(raw);
        if (!body.success) return oauthError(c, 'invalid_request', 'Paramètres manquants ou invalides');
        const b = body.data;
        const tokens =
            b.grant_type === 'authorization_code'
                ? await store.exchangeCode({
                      code: b.code,
                      clientId: b.client_id,
                      redirectUri: b.redirect_uri,
                      codeVerifier: b.code_verifier,
                  })
                : await store.refresh(b.refresh_token, b.client_id);
        if (!tokens) return oauthError(c, 'invalid_grant', 'Autorisation invalide, expirée ou révoquée');
        c.header('Cache-Control', 'no-store');
        return c.json(tokens);
    });

    return app;
}
