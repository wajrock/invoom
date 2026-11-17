import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {z} from 'zod';
import {parseJson, uuidParam} from '../../core/http.ts';
import type {Sessions} from '../auth/sessions.ts';
import {publicOrigin} from './oauth.routes.ts';
import type {OAuthStore} from './oauth.store.ts';

const decisionSchema = z.object({
    approve: z.boolean(),
    client_id: z.string().max(100),
    redirect_uri: z.string().max(500),
    code_challenge: z.string().min(43).max(128),
    state: z.string().max(500).optional(),
});

/**
 * Consent page and connection management, for the signed-in user only (app session cookie): an agent's
 * token gives no access here, so an agent can neither approve itself nor manage connections.
 */
export function consentRoutes(sessions: Sessions, store: OAuthStore, trustForwarded: boolean) {
    async function knownClient(clientId: string, redirectUri: string) {
        const client = await store.client(clientId);
        if (!client || !client.redirectUris.includes(redirectUri)) {
            throw new HTTPException(400, {message: 'Application inconnue ou adresse de retour non enregistrée'});
        }
        return client;
    }

    return new Hono()
        .get('/client', async (c) => {
            await sessions.require(c);
            const client = await knownClient(c.req.query('client_id') ?? '', c.req.query('redirect_uri') ?? '');
            return c.json({name: client.name, redirectHost: new URL(c.req.query('redirect_uri')!).host});
        })
        .post('/decision', async (c) => {
            const session = await sessions.require(c);
            const d = await parseJson(c, decisionSchema);
            await knownClient(d.client_id, d.redirect_uri);
            const back = new URL(d.redirect_uri);
            if (d.approve) {
                const code = await store.createCode({
                    clientId: d.client_id,
                    userId: session.userId,
                    workspaceId: session.workspaceId,
                    redirectUri: d.redirect_uri,
                    codeChallenge: d.code_challenge,
                });
                back.searchParams.set('code', code);
            } else {
                back.searchParams.set('error', 'access_denied');
            }
            if (d.state) back.searchParams.set('state', d.state);
            // Issuer (RFC 9207): tells the agent which server answered
            back.searchParams.set('iss', publicOrigin(c, trustForwarded));
            return c.json({redirect: back.toString()});
        })
        .get('/connections', async (c) => {
            const {userId} = await sessions.require(c);
            return c.json(await store.listConnections(userId));
        })
        .delete('/connections/:id', async (c) => {
            const {userId} = await sessions.require(c);
            if (!(await store.revoke(userId, uuidParam(c)))) throw new HTTPException(404, {message: 'Introuvable'});
            return c.body(null, 204);
        });
}
