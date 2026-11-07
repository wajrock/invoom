import {
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
    type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import {eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {z} from 'zod';
import {parseJson} from '../../core/http.ts';
import {passkeys} from '../../db/schema/index.ts';
import type {AuthContext} from './auth.context.ts';
import {credentialJson} from './auth.schemas.ts';
import {relyingParty} from './request.ts';

/** Discoverable passkeys: the device offers the right credential, no username needed. */
export const passkeyLoginRoutes = ({db, limiter, sessions, challenges}: AuthContext) =>
    new Hono()
        .post('/passkey/login/options', async (c) => {
            await limiter.assertNotLocked(c);
            const options = await generateAuthenticationOptions({
                rpID: relyingParty(c).rpID,
                userVerification: 'required',
            });
            return c.json({challengeId: await challenges.save(options.challenge, 'login'), options});
        })
        .post('/passkey/login/verify', async (c) => {
            await limiter.assertNotLocked(c);
            const body = await parseJson(c, z.object({challengeId: z.string().max(64), response: credentialJson}));
            const response = body.response as unknown as AuthenticationResponseJSON;

            const challenge = await challenges.take(body.challengeId, 'login');
            if (!challenge) return limiter.fail(c, 'Demande expirée, réessaie.');
            const [key] = await db.select().from(passkeys).where(eq(passkeys.id, response.id));
            if (!key) return limiter.fail(c, 'Passkey inconnue');

            const {origin, rpID} = relyingParty(c);
            const counter = await verifyAuthenticationResponse({
                response,
                expectedChallenge: challenge.challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                requireUserVerification: true,
                credential: {
                    id: key.id,
                    publicKey: new Uint8Array(key.publicKey),
                    counter: key.counter,
                    transports: key.transports ? key.transports.split(',') : [],
                },
            }).then(
                (result) => (result.verified ? result.authenticationInfo.newCounter : null),
                () => null,
            );
            if (counter === null) return limiter.fail(c);

            await db.update(passkeys).set({counter, lastUsedAt: new Date()}).where(eq(passkeys.id, key.id));
            await limiter.clear(c);
            await sessions.open(c, key.userId);
            return c.json({ok: true});
        });
