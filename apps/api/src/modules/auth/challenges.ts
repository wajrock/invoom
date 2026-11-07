import {and, eq, lt} from 'drizzle-orm';
import {randomBytes} from 'node:crypto';
import type {Db} from '../../db/client.ts';
import {authChallenges} from '../../db/schema/index.ts';
import {CHALLENGE_TTL_MS} from './auth.config.ts';

type ChallengeKind = 'login' | 'register';

export type Challenges = ReturnType<typeof createChallenges>;

export function createChallenges(db: Db) {
    return {
        async save(challenge: string, kind: ChallengeKind, extra: {userId?: string; emailTokenHash?: string} = {}) {
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
        },

        /** Returns and deletes the challenge: each one is single use. */
        async take(id: string, kind: ChallengeKind) {
            const [row] = await db
                .delete(authChallenges)
                .where(and(eq(authChallenges.id, id), eq(authChallenges.kind, kind)))
                .returning();
            return row && row.expiresAt > new Date() ? row : null;
        },
    };
}
