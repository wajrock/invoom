import {createHash, randomBytes} from 'node:crypto';
import {and, count, desc, eq, gt, lt, or, sql} from 'drizzle-orm';
import type {Db} from '../../db/client.ts';
import {agentConnections, agentTokens, oauthClients, oauthCodes} from '../../db/schema/index.ts';
import {sha256} from '../auth/tokens.ts';

/** Access tokens are short so a leaked one soon stops working; the connection itself never expires. */
export const ACCESS_TOKEN_TTL_S = 60 * 60;
const CODE_TTL_MS = 5 * 60 * 1000;

const randomToken = (prefix: string) => `${prefix}_${randomBytes(32).toString('base64url')}`;
const hashToken = (kind: string, token: string) => sha256(`agent-${kind}:${token}`);

/** HTTPS everywhere, plain HTTP only on the user's own machine (desktop and command-line agents). */
export function isAllowedRedirectUri(uri: string): boolean {
    try {
        const url = new URL(uri);
        if (url.hash) return false;
        if (url.protocol === 'https:') return true;
        return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch {
        return false;
    }
}

/** PKCE S256: base64url(SHA-256(verifier)) */
export function pkceChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

export interface TokenSet {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    scope: string;
}

export interface AgentIdentity {
    connectionId: string;
    userId: string;
    workspaceId: string;
}

export type OAuthStore = ReturnType<typeof createOAuthStore>;

export function createOAuthStore(db: Db) {
    async function issueAccessToken(connectionId: string): Promise<string> {
        const token = randomToken('inv_at');
        await db.delete(agentTokens).where(lt(agentTokens.expiresAt, new Date()));
        await db.insert(agentTokens).values({
            hash: hashToken('access', token),
            connectionId,
            expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000),
        });
        return token;
    }

    const tokenSet = (access: string, refresh: string): TokenSet => ({
        access_token: access,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_S,
        refresh_token: refresh,
        scope: 'invoom',
    });

    return {
        async registerClient(name: string, redirectUris: string[]) {
            const id = randomToken('inv_client');
            await db.insert(oauthClients).values({id, name, redirectUris});
            return id;
        },

        /** Registrations nobody approved within a day: agents register again when they need to */
        async pruneClients() {
            await db
                .delete(oauthClients)
                .where(
                    and(
                        lt(oauthClients.createdAt, new Date(Date.now() - 864e5)),
                        sql`not exists (select 1 from ${agentConnections} where ${agentConnections.clientId} = ${oauthClients.id})`,
                    ),
                );
        },

        async registrationsSince(since: Date): Promise<number> {
            const [{n}] = await db.select({n: count()}).from(oauthClients).where(gt(oauthClients.createdAt, since));
            return n;
        },

        async client(id: string) {
            const [client] = await db.select().from(oauthClients).where(eq(oauthClients.id, id));
            return client ?? null;
        },

        async createCode(input: {
            clientId: string;
            userId: string;
            workspaceId: string;
            redirectUri: string;
            codeChallenge: string;
        }): Promise<string> {
            const code = randomToken('inv_code');
            await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, new Date()));
            await db
                .insert(oauthCodes)
                .values({...input, hash: hashToken('code', code), expiresAt: new Date(Date.now() + CODE_TTL_MS)});
            return code;
        },

        /** Authorization code grant: the code is consumed whatever the outcome. */
        async exchangeCode(input: {
            code: string;
            clientId: string;
            redirectUri: string;
            codeVerifier: string;
        }): Promise<TokenSet | null> {
            const [code] = await db
                .delete(oauthCodes)
                .where(eq(oauthCodes.hash, hashToken('code', input.code)))
                .returning();
            if (
                !code ||
                code.expiresAt < new Date() ||
                code.clientId !== input.clientId ||
                code.redirectUri !== input.redirectUri ||
                code.codeChallenge !== pkceChallenge(input.codeVerifier)
            ) {
                return null;
            }
            const refresh = randomToken('inv_rt');
            const [connection] = await db
                .insert(agentConnections)
                .values({
                    clientId: code.clientId,
                    userId: code.userId,
                    workspaceId: code.workspaceId,
                    refreshHash: hashToken('refresh', refresh),
                })
                .returning({id: agentConnections.id});
            return tokenSet(await issueAccessToken(connection.id), refresh);
        },

        /**
         * Refresh token grant, with rotation. A refresh token that was already rotated means it was copied: the
         * connection is revoked, so neither the thief nor the agent keeps access.
         */
        async refresh(refreshToken: string, clientId: string): Promise<TokenSet | null> {
            const hash = hashToken('refresh', refreshToken);
            const [connection] = await db
                .select()
                .from(agentConnections)
                .where(or(eq(agentConnections.refreshHash, hash), eq(agentConnections.previousRefreshHash, hash)));
            if (!connection || connection.clientId !== clientId) return null;
            if (connection.refreshHash !== hash) {
                await db.delete(agentConnections).where(eq(agentConnections.id, connection.id));
                return null;
            }
            const next = randomToken('inv_rt');
            await db
                .update(agentConnections)
                .set({refreshHash: hashToken('refresh', next), previousRefreshHash: hash, lastUsedAt: new Date()})
                .where(eq(agentConnections.id, connection.id));
            return tokenSet(await issueAccessToken(connection.id), next);
        },

        /** The connection behind a valid access token, or null. */
        async verifyAccessToken(token: string): Promise<AgentIdentity | null> {
            const [row] = await db
                .select({
                    connectionId: agentConnections.id,
                    userId: agentConnections.userId,
                    workspaceId: agentConnections.workspaceId,
                    expiresAt: agentTokens.expiresAt,
                    lastUsedAt: agentConnections.lastUsedAt,
                })
                .from(agentTokens)
                .innerJoin(agentConnections, eq(agentConnections.id, agentTokens.connectionId))
                .where(eq(agentTokens.hash, hashToken('access', token)));
            if (!row || row.expiresAt < new Date()) return null;
            // At most one write a minute for the "last used" date shown in the settings
            if (Date.now() - row.lastUsedAt.getTime() > 60_000) {
                await db
                    .update(agentConnections)
                    .set({lastUsedAt: new Date()})
                    .where(eq(agentConnections.id, row.connectionId));
            }
            return {connectionId: row.connectionId, userId: row.userId, workspaceId: row.workspaceId};
        },

        async listConnections(userId: string) {
            return db
                .select({
                    id: agentConnections.id,
                    name: oauthClients.name,
                    createdAt: agentConnections.createdAt,
                    lastUsedAt: agentConnections.lastUsedAt,
                })
                .from(agentConnections)
                .innerJoin(oauthClients, eq(oauthClients.id, agentConnections.clientId))
                .where(eq(agentConnections.userId, userId))
                .orderBy(desc(agentConnections.createdAt));
        },

        /** Revokes the connection and its tokens (cascade); only its owner can. */
        async revoke(userId: string, connectionId: string): Promise<boolean> {
            const deleted = await db
                .delete(agentConnections)
                .where(and(eq(agentConnections.id, connectionId), eq(agentConnections.userId, userId)))
                .returning({id: agentConnections.id});
            return deleted.length > 0;
        },
    };
}
