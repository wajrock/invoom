import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {and, eq, isNull} from 'drizzle-orm';
import {Hono, type Context} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {parseJson} from '../../core/http.ts';
import type {Db} from '../../db/client.ts';
import {emailTokens, passkeys, users, workspaceMembers} from '../../db/schema/index.ts';
import {RP_NAME} from './auth.config.ts';
import type {AuthContext} from './auth.context.ts';
import {credentialJson} from './auth.schemas.ts';
import {relyingParty} from './request.ts';
import {hashEmailToken} from './tokens.ts';

const INVALID_LINK = 'Lien invalide ou expiré. Demande un nouveau lien.';

/**
 * Creates a passkey for: a signed-in user adding a device, a new account (sign-up link),
 * or an existing account regaining access (recovery link).
 */
export const passkeyRegisterRoutes = (ctx: AuthContext) => {
    const {db, limiter, sessions, challenges, recoveryCodes, emailLinks, workspaces} = ctx;

    /** The account the new passkey is for, from the session or from an email link. */
    async function resolveTarget(c: Context, token: string | undefined) {
        const session = await sessions.current(c);
        if (session) {
            const [{email}] = await db.select({email: users.email}).from(users).where(eq(users.id, session.userId));
            return {userId: session.userId, email};
        }
        await limiter.assertNotLocked(c);
        if (!token) throw new HTTPException(401, {message: 'Non authentifié'});
        const emailTokenHash = hashEmailToken(token);
        const link = await emailLinks.find(emailTokenHash);
        if (!link) return limiter.fail(c, INVALID_LINK);
        // For a sign-up the account id is chosen now, since it is embedded in the passkey
        return {userId: link.userId ?? randomUUID(), email: link.email, emailTokenHash};
    }

    async function createAccount(tx: Db, userId: string, email: string) {
        const [taken] = await tx.select({id: users.id}).from(users).where(eq(users.email, email));
        if (taken) {
            throw new HTTPException(409, {
                message: 'Un compte existe déjà avec cette adresse. Connecte-toi ou récupère ton accès.',
            });
        }
        await tx.insert(users).values({id: userId, email});
        const workspaceId = await workspaces.createWorkspace(tx);
        await tx.insert(workspaceMembers).values({workspaceId, userId, role: 'owner'});
    }

    return new Hono()
        .post('/passkey/register/options', async (c) => {
            const {token} = await parseJson(c, z.object({token: z.string().max(128).optional()}));
            const target = await resolveTarget(c, token);
            const existing = await db
                .select({id: passkeys.id, transports: passkeys.transports})
                .from(passkeys)
                .where(eq(passkeys.userId, target.userId));
            const options = await generateRegistrationOptions({
                rpName: RP_NAME,
                rpID: relyingParty(c).rpID,
                userName: target.email,
                userDisplayName: target.email,
                userID: new TextEncoder().encode(target.userId),
                attestationType: 'none',
                excludeCredentials: existing.map((k) => ({
                    id: k.id,
                    transports: k.transports ? k.transports.split(',') : [],
                })),
                authenticatorSelection: {residentKey: 'required', userVerification: 'required'},
            });
            const challengeId = await challenges.save(options.challenge, 'register', {
                userId: target.userId,
                emailTokenHash: target.emailTokenHash,
            });
            return c.json({challengeId, options});
        })
        .post('/passkey/register/verify', async (c) => {
            const body = await parseJson(
                c,
                z.object({
                    challengeId: z.string().max(64),
                    name: z.string().trim().min(1).max(60),
                    response: credentialJson,
                }),
            );
            const challenge = await challenges.take(body.challengeId, 'register');
            if (!challenge?.userId) throw new HTTPException(400, {message: 'Demande expirée, réessaie.'});
            const userId = challenge.userId;

            const session = await sessions.current(c);
            const link = challenge.emailTokenHash ? await emailLinks.find(challenge.emailTokenHash) : null;
            if (session ? session.userId !== userId : !link) return limiter.fail(c, INVALID_LINK);

            const {origin, rpID} = relyingParty(c);
            const info = await verifyRegistrationResponse({
                response: body.response as unknown as RegistrationResponseJSON,
                expectedChallenge: challenge.challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                requireUserVerification: true,
            }).then(
                (result) => (result.verified ? result.registrationInfo : null),
                () => null,
            );
            if (!info) throw new HTTPException(400, {message: 'Passkey refusée par le serveur'});

            await db.transaction(async (tx) => {
                if (link) {
                    // Guards against the same link being submitted twice concurrently
                    const used = await tx
                        .update(emailTokens)
                        .set({usedAt: new Date()})
                        .where(and(eq(emailTokens.hash, link.hash), isNull(emailTokens.usedAt)))
                        .returning({hash: emailTokens.hash});
                    if (!used.length) throw new HTTPException(409, {message: 'Ce lien a déjà été utilisé.'});
                    if (link.purpose === 'signup') await createAccount(tx as unknown as Db, userId, link.email);
                }
                await tx.insert(passkeys).values({
                    id: info.credential.id,
                    userId,
                    publicKey: Buffer.from(info.credential.publicKey),
                    counter: info.credential.counter,
                    transports: (info.credential.transports ?? []).join(','),
                    name: body.name,
                });
            });

            if (!session) {
                await limiter.clear(c);
                await sessions.open(c, userId);
            }
            const codes = (await recoveryCodes.remaining(userId)) === 0 ? await recoveryCodes.issue(userId) : null;
            return c.json({ok: true, recoveryCodes: codes});
        });
};
