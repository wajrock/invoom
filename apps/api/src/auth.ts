import {getConnInfo} from '@hono/node-server/conninfo';
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
    type AuthenticationResponseJSON,
    type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {and, asc, count, eq, gt, isNull, lt} from 'drizzle-orm';
import {Hono, type Context, type MiddlewareHandler} from 'hono';
import {deleteCookie, getCookie, setCookie} from 'hono/cookie';
import {HTTPException} from 'hono/http-exception';
import {randomBytes, randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Db} from './db/client.ts';
import {
    authChallenges,
    emailTokens,
    loginAttempts,
    passkeys,
    recoveryCodes,
    sessions,
    users,
    workspaceMembers,
} from './db/schema.ts';
import type {WorkspaceRuntime} from './db/workspace.ts';
import {parseJson} from './lib/http.ts';
import {mails, type Mailer} from './lib/mailer.ts';
import {generateEmailToken, generateRecoveryCodes, hashEmailToken, hashRecoveryCode, sha256} from './lib/recovery.ts';

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const EMAIL_TOKEN_TTL_MS = 30 * 60 * 1000;
const IP_MAX_FAILURES = 5;
const IP_BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 3600 * 1000;
/** Plafond global (toutes IP) contre les attaques distribuées */
const GLOBAL_MAX_FAILURES = 200;
const GLOBAL_WINDOW_MS = 24 * 3600 * 1000;
const GLOBAL_LOCK_MS = 60 * 60 * 1000;
/** Limites d'envoi d'e-mails (anti-spam) */
const MAIL_PER_ADDRESS = {max: 3, windowMs: 3600 * 1000};
const MAIL_PER_IP = {max: 10, windowMs: 3600 * 1000};

const RP_NAME = 'Freelance Hub';

export interface AuthOptions {
    db: Db;
    workspaces: WorkspaceRuntime;
    mailer: Mailer;
    secureCookies: boolean;
    trustProxy: boolean;
}

export interface SessionInfo {
    userId: string;
    workspaceId: string;
    expiresAt: Date;
}

/** Les réponses WebAuthn sont validées en profondeur par la bibliothèque ; ici on vérifie seulement la forme. */
const credentialJson = z.looseObject({
    id: z.string().min(1).max(1024),
    rawId: z.string(),
    type: z.literal('public-key'),
    response: z.looseObject({}),
});
const emailSchema = z.object({
    email: z
        .email('Adresse e-mail invalide')
        .max(254)
        .transform((v) => v.trim().toLowerCase()),
});

export function createAuth(opts: AuthOptions) {
    const {db, mailer} = opts;
    const cookieName = opts.secureCookies ? '__Host-fh_session' : 'fh_session';

    function clientIp(c: Context): string {
        if (opts.trustProxy) {
            const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
            if (fwd) return fwd;
        }
        return getConnInfo(c).remote.address ?? 'unknown';
    }

    /** Origine et RP ID WebAuthn, déduits de la requête (l'origine est déjà vérifiée par le middleware CSRF). */
    function relyingParty(c: Context) {
        const origin = c.req.header('origin');
        if (!origin) throw new HTTPException(400, {message: 'Origine manquante'});
        return {origin, rpID: new URL(origin).hostname};
    }

    // ------------------------------------------------------------------ anti brute-force

    async function lockedUntil(key: string): Promise<Date | null> {
        const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
        return row?.lockedUntil && row.lockedUntil > new Date() ? row.lockedUntil : null;
    }

    async function assertNotLocked(c: Context) {
        const lock = (await lockedUntil(clientIp(c))) ?? (await lockedUntil('*'));
        if (lock) {
            const minutes = Math.ceil((lock.getTime() - Date.now()) / 60000);
            throw new HTTPException(429, {message: `Trop de tentatives. Réessaie dans ${minutes} min.`});
        }
    }

    async function registerFailure(c: Context) {
        const ip = clientIp(c);
        const now = new Date();
        // Par IP : verrouillage progressif (15 min, 30 min, 1 h… jusqu'à 24 h)
        const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, ip));
        const failures = (row?.failures ?? 0) + 1;
        let lockouts = row?.lockouts ?? 0;
        let locked: Date | null = null;
        if (failures >= IP_MAX_FAILURES) {
            lockouts += 1;
            locked = new Date(now.getTime() + Math.min(IP_BASE_LOCK_MS * 2 ** (lockouts - 1), MAX_LOCK_MS));
        }
        const ipValues = {failures: locked ? 0 : failures, lockouts, lockedUntil: locked, windowStart: now};
        await db
            .insert(loginAttempts)
            .values({key: ip, ...ipValues})
            .onConflictDoUpdate({target: loginAttempts.key, set: ipValues});

        // Global : fenêtre glissante de 24 h
        const [g] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, '*'));
        const expired = !g || now.getTime() - g.windowStart.getTime() > GLOBAL_WINDOW_MS;
        const gFailures = (expired ? 0 : g.failures) + 1;
        const gLocked = gFailures >= GLOBAL_MAX_FAILURES ? new Date(now.getTime() + GLOBAL_LOCK_MS) : null;
        const gValues = {
            failures: gLocked ? 0 : gFailures,
            lockouts: 0,
            lockedUntil: gLocked,
            windowStart: expired || gLocked ? now : g.windowStart,
        };
        await db
            .insert(loginAttempts)
            .values({key: '*', ...gValues})
            .onConflictDoUpdate({target: loginAttempts.key, set: gValues});
    }

    /** Échec d'authentification : compté, puis réponse sans détail exploitable. */
    async function fail(c: Context, message = 'Authentification refusée'): Promise<never> {
        await registerFailure(c);
        throw new HTTPException(401, {message});
    }

    /** Compteur à fenêtre fixe (envois d'e-mails) : refuse au-delà de `max` dans la fenêtre. */
    async function throttle(key: string, {max, windowMs}: {max: number; windowMs: number}) {
        const now = new Date();
        const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
        const fresh = !row || now.getTime() - row.windowStart.getTime() > windowMs;
        const n = (fresh ? 0 : row.failures) + 1;
        if (n > max) throw new HTTPException(429, {message: 'Trop de demandes. Réessaie dans une heure.'});
        const values = {failures: n, lockouts: 0, lockedUntil: null, windowStart: fresh ? now : row.windowStart};
        await db
            .insert(loginAttempts)
            .values({key, ...values})
            .onConflictDoUpdate({target: loginAttempts.key, set: values});
    }

    // ------------------------------------------------------------------ sessions

    async function currentSession(c: Context): Promise<SessionInfo | null> {
        const token = getCookie(c, cookieName);
        if (!token) return null;
        const [s] = await db
            .select()
            .from(sessions)
            .where(eq(sessions.id, sha256(token)));
        if (!s || s.expiresAt < new Date()) return null;
        return {userId: s.userId, workspaceId: s.workspaceId, expiresAt: s.expiresAt};
    }

    async function openSession(c: Context, userId: string) {
        const [m] = await db
            .select({workspaceId: workspaceMembers.workspaceId})
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, userId))
            .orderBy(asc(workspaceMembers.createdAt))
            .limit(1);
        if (!m) throw new HTTPException(403, {message: 'Aucun espace associé à ce compte'});
        await db.delete(loginAttempts).where(eq(loginAttempts.key, clientIp(c)));
        await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
        await db.insert(sessions).values({id: sha256(token), userId, workspaceId: m.workspaceId, expiresAt});
        setCookie(c, cookieName, token, {
            httpOnly: true,
            secure: opts.secureCookies,
            sameSite: 'Strict',
            path: '/',
            expires: expiresAt,
        });
    }

    // ------------------------------------------------------------------ défis, jetons e-mail, codes

    async function saveChallenge(
        challenge: string,
        kind: 'login' | 'register',
        extra: {userId?: string; emailTokenHash?: string} = {},
    ) {
        await db.delete(authChallenges).where(lt(authChallenges.expiresAt, new Date()));
        const id = randomBytes(18).toString('base64url');
        await db.insert(authChallenges).values({
            id,
            challenge,
            kind,
            userId: extra.userId ?? null,
            emailTokenHash: extra.emailTokenHash ?? null,
            expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
        });
        return id;
    }

    /** Récupère et supprime le défi (usage unique). */
    async function takeChallenge(id: string, kind: 'login' | 'register') {
        const [row] = await db
            .delete(authChallenges)
            .where(and(eq(authChallenges.id, id), eq(authChallenges.kind, kind)))
            .returning();
        return row && row.expiresAt > new Date() ? row : null;
    }

    async function validEmailToken(hash: string) {
        const [t] = await db
            .select()
            .from(emailTokens)
            .where(and(eq(emailTokens.hash, hash), isNull(emailTokens.usedAt), gt(emailTokens.expiresAt, new Date())));
        return t ?? null;
    }

    async function sendLink(c: Context, purpose: 'signup' | 'recover', email: string, userId: string | null) {
        const token = generateEmailToken();
        await db.insert(emailTokens).values({
            hash: hashEmailToken(token),
            purpose,
            email,
            userId,
            expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
        });
        const url = `${relyingParty(c).origin}/login?token=${token}`;
        await mailer.send(purpose === 'signup' ? mails.signup(email, url) : mails.recover(email, url));
    }

    async function userPasskeyCount(userId: string) {
        const [{n}] = await db.select({n: count()}).from(passkeys).where(eq(passkeys.userId, userId));
        return n;
    }

    async function remainingRecoveryCodes(userId: string) {
        const [{n}] = await db
            .select({n: count()})
            .from(recoveryCodes)
            .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
        return n;
    }

    /** Remplace tous les codes de récupération du compte ; les nouveaux codes ne sont renvoyés qu'une fois. */
    async function issueRecoveryCodes(userId: string) {
        const codes = generateRecoveryCodes();
        await db.transaction(async (tx) => {
            await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
            await tx.insert(recoveryCodes).values(codes.map((code) => ({hash: hashRecoveryCode(code), userId})));
        });
        return codes;
    }

    async function sessionOr401(c: Context) {
        const s = await currentSession(c);
        if (!s) throw new HTTPException(401, {message: 'Non authentifié'});
        return s;
    }

    // ------------------------------------------------------------------ middleware des routes métier

    /** Session requise ; la suite de la requête s'exécute dans l'espace de travail de la session. */
    const requireAuth: MiddlewareHandler = async (c, next) => {
        const s = await currentSession(c);
        if (!s) return c.json({error: 'Non authentifié'}, 401);
        await opts.workspaces.run({workspaceId: s.workspaceId, userId: s.userId}, async () => {
            await next();
            // Erreur dans la route : on annule la transaction (l'erreur est ensuite traitée par app.onError)
            if (c.error) throw c.error;
        });
    };

    // ------------------------------------------------------------------ routes

    const routes = new Hono()
        .get('/me', async (c) => {
            const s = await currentSession(c);
            if (!s) return c.json({authenticated: false, email: null});
            const [u] = await db.select({email: users.email}).from(users).where(eq(users.id, s.userId));
            return c.json({authenticated: true, email: u?.email ?? null, expiresAt: s.expiresAt});
        })

        // ---- Inscription et récupération par e-mail (réponse identique que le compte existe ou non)
        .post('/signup', async (c) => {
            const {email} = await parseJson(c, emailSchema);
            await throttle(`mail-ip:${clientIp(c)}`, MAIL_PER_IP);
            await throttle(`mail:${email}`, MAIL_PER_ADDRESS);
            const [existing] = await db.select({id: users.id}).from(users).where(eq(users.email, email));
            // Compte déjà existant : on envoie un lien d'accès plutôt qu'une inscription (sans le révéler ici)
            await sendLink(c, existing ? 'recover' : 'signup', email, existing?.id ?? null);
            return c.json({ok: true});
        })
        .post('/recover', async (c) => {
            const {email} = await parseJson(c, emailSchema);
            await throttle(`mail-ip:${clientIp(c)}`, MAIL_PER_IP);
            await throttle(`mail:${email}`, MAIL_PER_ADDRESS);
            const [existing] = await db.select({id: users.id}).from(users).where(eq(users.email, email));
            if (existing) await sendLink(c, 'recover', email, existing.id);
            return c.json({ok: true});
        })
        /** Vérifie un lien reçu par e-mail avant d'afficher l'écran de création de passkey. */
        .post('/token', async (c) => {
            await assertNotLocked(c);
            const {token} = await parseJson(c, z.object({token: z.string().min(1).max(128)}));
            const t = await validEmailToken(hashEmailToken(token));
            if (!t) return fail(c, 'Lien invalide ou expiré. Demande un nouveau lien.');
            return c.json({purpose: t.purpose, email: t.email});
        })

        // ---- Connexion par passkey (passkeys « découvrables » : l'appareil propose la bonne clé)
        .post('/passkey/login/options', async (c) => {
            await assertNotLocked(c);
            const options = await generateAuthenticationOptions({
                rpID: relyingParty(c).rpID,
                userVerification: 'required',
            });
            return c.json({challengeId: await saveChallenge(options.challenge, 'login'), options});
        })
        .post('/passkey/login/verify', async (c) => {
            await assertNotLocked(c);
            const body = await parseJson(c, z.object({challengeId: z.string().max(64), response: credentialJson}));
            const response = body.response as unknown as AuthenticationResponseJSON;
            const challenge = await takeChallenge(body.challengeId, 'login');
            if (!challenge) return fail(c, 'Demande expirée, réessaie.');
            const [key] = await db.select().from(passkeys).where(eq(passkeys.id, response.id));
            if (!key) return fail(c, 'Passkey inconnue');
            const {origin, rpID} = relyingParty(c);
            let newCounter: number | null = null;
            try {
                const result = await verifyAuthenticationResponse({
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
                });
                if (result.verified) newCounter = result.authenticationInfo.newCounter;
            } catch {
                newCounter = null;
            }
            if (newCounter === null) return fail(c);
            await db.update(passkeys).set({counter: newCounter, lastUsedAt: new Date()}).where(eq(passkeys.id, key.id));
            await openSession(c, key.userId);
            return c.json({ok: true});
        })

        // ---- Code de récupération
        .post('/recovery', async (c) => {
            await assertNotLocked(c);
            const {code} = await parseJson(c, z.object({code: z.string().min(1).max(64)}));
            const [row] = await db
                .update(recoveryCodes)
                .set({usedAt: new Date()})
                .where(and(eq(recoveryCodes.hash, hashRecoveryCode(code)), isNull(recoveryCodes.usedAt)))
                .returning({userId: recoveryCodes.userId});
            if (!row) return fail(c, 'Code de récupération invalide');
            await openSession(c, row.userId);
            return c.json({ok: true, remaining: await remainingRecoveryCodes(row.userId)});
        })

        // ---- Création d'une passkey : session ouverte (nouvel appareil) ou lien e-mail (inscription / récupération)
        .post('/passkey/register/options', async (c) => {
            const {token} = await parseJson(c, z.object({token: z.string().max(128).optional()}));
            const session = await currentSession(c);
            let userId: string;
            let email: string;
            let emailTokenHash: string | undefined;
            if (session) {
                userId = session.userId;
                [{email}] = await db.select({email: users.email}).from(users).where(eq(users.id, userId));
            } else {
                await assertNotLocked(c);
                if (!token) throw new HTTPException(401, {message: 'Non authentifié'});
                emailTokenHash = hashEmailToken(token);
                const t = await validEmailToken(emailTokenHash);
                if (!t) return fail(c, 'Lien invalide ou expiré. Demande un nouveau lien.');
                email = t.email;
                // Inscription : l'identifiant du futur compte est fixé dès maintenant (lié à la passkey)
                userId = t.userId ?? randomUUID();
            }
            const existing = await db
                .select({id: passkeys.id, transports: passkeys.transports})
                .from(passkeys)
                .where(eq(passkeys.userId, userId));
            const options = await generateRegistrationOptions({
                rpName: RP_NAME,
                rpID: relyingParty(c).rpID,
                userName: email,
                userDisplayName: email,
                userID: new TextEncoder().encode(userId),
                attestationType: 'none',
                excludeCredentials: existing.map((k) => ({
                    id: k.id,
                    transports: k.transports ? k.transports.split(',') : [],
                })),
                authenticatorSelection: {residentKey: 'required', userVerification: 'required'},
            });
            return c.json({
                challengeId: await saveChallenge(options.challenge, 'register', {userId, emailTokenHash}),
                options,
            });
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
            const response = body.response as unknown as RegistrationResponseJSON;
            const challenge = await takeChallenge(body.challengeId, 'register');
            if (!challenge?.userId) throw new HTTPException(400, {message: 'Demande expirée, réessaie.'});
            const session = await currentSession(c);
            const token = challenge.emailTokenHash ? await validEmailToken(challenge.emailTokenHash) : null;
            if (session ? session.userId !== challenge.userId : !token)
                return fail(c, 'Lien invalide ou expiré. Demande un nouveau lien.');

            const {origin, rpID} = relyingParty(c);
            let info;
            try {
                const result = await verifyRegistrationResponse({
                    response,
                    expectedChallenge: challenge.challenge,
                    expectedOrigin: origin,
                    expectedRPID: rpID,
                    requireUserVerification: true,
                });
                info = result.verified ? result.registrationInfo : null;
            } catch {
                info = null;
            }
            if (!info) throw new HTTPException(400, {message: 'Passkey refusée par le serveur'});
            const credential = info.credential;
            const userId = challenge.userId;

            await db.transaction(async (tx) => {
                if (token) {
                    // Jeton consommé une seule fois, même en cas de double envoi
                    const used = await tx
                        .update(emailTokens)
                        .set({usedAt: new Date()})
                        .where(and(eq(emailTokens.hash, token.hash), isNull(emailTokens.usedAt)))
                        .returning({hash: emailTokens.hash});
                    if (!used.length) throw new HTTPException(409, {message: 'Ce lien a déjà été utilisé.'});
                    if (token.purpose === 'signup') {
                        const [taken] = await tx.select({id: users.id}).from(users).where(eq(users.email, token.email));
                        if (taken)
                            throw new HTTPException(409, {
                                message:
                                    'Un compte existe déjà avec cette adresse. Connecte-toi ou récupère ton accès.',
                            });
                        await tx.insert(users).values({id: userId, email: token.email});
                        const workspaceId = await opts.workspaces.createWorkspace(tx as unknown as Db);
                        await tx.insert(workspaceMembers).values({workspaceId, userId, role: 'owner'});
                    }
                }
                await tx.insert(passkeys).values({
                    id: credential.id,
                    userId,
                    publicKey: Buffer.from(credential.publicKey),
                    counter: credential.counter,
                    transports: (credential.transports ?? []).join(','),
                    name: body.name,
                });
            });
            if (!session) await openSession(c, userId);
            // Première passkey (ou plus aucun code) : un nouveau jeu de codes de récupération
            const codes = (await remainingRecoveryCodes(userId)) === 0 ? await issueRecoveryCodes(userId) : null;
            return c.json({ok: true, recoveryCodes: codes});
        })

        // ---- Gestion du compte (session requise)
        .get('/passkeys', async (c) => {
            const s = await sessionOr401(c);
            const list = await db
                .select({
                    id: passkeys.id,
                    name: passkeys.name,
                    createdAt: passkeys.createdAt,
                    lastUsedAt: passkeys.lastUsedAt,
                })
                .from(passkeys)
                .where(eq(passkeys.userId, s.userId))
                .orderBy(passkeys.createdAt);
            return c.json({passkeys: list, recoveryCodesRemaining: await remainingRecoveryCodes(s.userId)});
        })
        .delete('/passkeys/:id', async (c) => {
            const s = await sessionOr401(c);
            if ((await userPasskeyCount(s.userId)) <= 1) {
                throw new HTTPException(409, {
                    message: 'Impossible de supprimer la dernière passkey : ajoute d’abord un autre appareil.',
                });
            }
            const deleted = await db
                .delete(passkeys)
                .where(and(eq(passkeys.id, c.req.param('id')), eq(passkeys.userId, s.userId)))
                .returning({id: passkeys.id});
            if (!deleted.length) throw new HTTPException(404, {message: 'Passkey introuvable'});
            return c.json({ok: true});
        })
        .post('/recovery-codes', async (c) => {
            const s = await sessionOr401(c);
            return c.json({recoveryCodes: await issueRecoveryCodes(s.userId)});
        })

        .post('/logout', async (c) => {
            const token = getCookie(c, cookieName);
            if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
            deleteCookie(c, cookieName, {path: '/', secure: opts.secureCookies});
            return c.json({ok: true});
        });

    return {routes, requireAuth};
}
