import {and, count, eq, inArray, isNull} from 'drizzle-orm';
import type {Db} from '../../db/client.ts';
import {authChallenges, emailTokens, users, workspaceMembers, workspaces} from '../../db/schema/index.ts';

/**
 * Deletes an account and everything it owns, in one transaction:
 *  - the workspaces it is the only member of, with all their business data (invoices and files, payments, clients,
 *    settings…) and agent connections, through the `on delete cascade` foreign keys;
 *  - the user, with its passkeys, recovery codes, sessions and email links (same cascades);
 *  - what is not linked by a key: pending challenges and sign-up links sent to its address.
 * The brute-force counters keyed by address are kept: they expire on their own, and clearing them would reopen the
 * throttling.
 */
export async function deleteAccount(db: Db, userId: string, email: string) {
    await db.transaction(async (tx) => {
        const conn = tx as unknown as Db;
        const memberships = await conn
            .select({workspaceId: workspaceMembers.workspaceId})
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, userId));
        const owned: string[] = [];
        for (const {workspaceId} of memberships) {
            const [{n}] = await conn
                .select({n: count()})
                .from(workspaceMembers)
                .where(eq(workspaceMembers.workspaceId, workspaceId));
            // Shared workspaces (members can be invited later) stay for the others
            if (n === 1) owned.push(workspaceId);
        }
        if (owned.length) await conn.delete(workspaces).where(inArray(workspaces.id, owned));
        await conn.delete(authChallenges).where(eq(authChallenges.userId, userId));
        await conn.delete(emailTokens).where(and(eq(emailTokens.email, email), isNull(emailTokens.userId)));
        await conn.delete(users).where(eq(users.id, userId));
    });
}
