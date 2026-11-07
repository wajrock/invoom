import {asc, eq, lt} from 'drizzle-orm';
import type {Context} from 'hono';
import {deleteCookie, getCookie, setCookie} from 'hono/cookie';
import {HTTPException} from 'hono/http-exception';
import {randomBytes} from 'node:crypto';
import type {Db} from '../../db/client.ts';
import {sessions, workspaceMembers} from '../../db/schema/index.ts';
import {SESSION_TTL_MS} from './auth.config.ts';
import {sha256} from './tokens.ts';

export interface SessionInfo {
    userId: string;
    workspaceId: string;
    expiresAt: Date;
}

export type Sessions = ReturnType<typeof createSessions>;

export function createSessions(db: Db, secureCookies: boolean) {
    // __Host- cookies require HTTPS, which is only available in production
    const cookieName = secureCookies ? '__Host-invoom_session' : 'invoom_session';

    return {
        async current(c: Context): Promise<SessionInfo | null> {
            const token = getCookie(c, cookieName);
            if (!token) return null;
            const [s] = await db
                .select()
                .from(sessions)
                .where(eq(sessions.id, sha256(token)));
            if (!s || s.expiresAt < new Date()) return null;
            return {userId: s.userId, workspaceId: s.workspaceId, expiresAt: s.expiresAt};
        },

        async require(c: Context): Promise<SessionInfo> {
            const s = await this.current(c);
            if (!s) throw new HTTPException(401, {message: 'Non authentifié'});
            return s;
        },

        /** Opens a session on the user's first workspace. */
        async open(c: Context, userId: string) {
            const [membership] = await db
                .select({workspaceId: workspaceMembers.workspaceId})
                .from(workspaceMembers)
                .where(eq(workspaceMembers.userId, userId))
                .orderBy(asc(workspaceMembers.createdAt))
                .limit(1);
            if (!membership) throw new HTTPException(403, {message: 'Aucun espace associé à ce compte'});

            await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
            const token = randomBytes(32).toString('base64url');
            const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
            await db
                .insert(sessions)
                .values({id: sha256(token), userId, workspaceId: membership.workspaceId, expiresAt});
            setCookie(c, cookieName, token, {
                httpOnly: true,
                secure: secureCookies,
                sameSite: 'Strict',
                path: '/',
                expires: expiresAt,
            });
        },

        async close(c: Context) {
            const token = getCookie(c, cookieName);
            if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
            deleteCookie(c, cookieName, {path: '/', secure: secureCookies});
        },
    };
}
