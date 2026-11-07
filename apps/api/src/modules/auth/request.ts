import {getConnInfo} from '@hono/node-server/conninfo';
import type {Context} from 'hono';
import {HTTPException} from 'hono/http-exception';

export function clientIp(c: Context, trustProxy: boolean): string {
    if (trustProxy) {
        const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
        if (forwarded) return forwarded;
    }
    return getConnInfo(c).remote.address ?? 'unknown';
}

/** WebAuthn origin and RP ID come from the request; the CSRF middleware has already checked the origin. */
export function relyingParty(c: Context) {
    const origin = c.req.header('origin');
    if (!origin) throw new HTTPException(400, {message: 'Origine manquante'});
    return {origin, rpID: new URL(origin).hostname};
}
