import {and, count, eq, isNull} from 'drizzle-orm';
import type {Db} from '../../db/client.ts';
import {recoveryCodes} from '../../db/schema/index.ts';
import {generateRecoveryCodes, hashRecoveryCode} from './tokens.ts';

export type RecoveryCodes = ReturnType<typeof createRecoveryCodes>;

export function createRecoveryCodes(db: Db) {
    return {
        async remaining(userId: string) {
            const [{n}] = await db
                .select({n: count()})
                .from(recoveryCodes)
                .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
            return n;
        },

        /** Replaces every code of the account; the new codes are only ever returned here. */
        async issue(userId: string) {
            const codes = generateRecoveryCodes();
            await db.transaction(async (tx) => {
                await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
                await tx.insert(recoveryCodes).values(codes.map((code) => ({hash: hashRecoveryCode(code), userId})));
            });
            return codes;
        },

        /** Marks the code as used and returns its owner, or null if it is unknown or already used. */
        async consume(code: string): Promise<string | null> {
            const [row] = await db
                .update(recoveryCodes)
                .set({usedAt: new Date()})
                .where(and(eq(recoveryCodes.hash, hashRecoveryCode(code)), isNull(recoveryCodes.usedAt)))
                .returning({userId: recoveryCodes.userId});
            return row?.userId ?? null;
        },
    };
}
