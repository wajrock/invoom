import {and, eq, gt, isNull} from 'drizzle-orm';
import type {Db} from '../../db/client.ts';
import {emailTokens} from '../../db/schema/index.ts';
import type {Mailer} from '../../core/mailer.ts';
import {authMails} from './auth-mails.ts';
import {EMAIL_TOKEN_TTL_MS} from './auth.config.ts';
import {generateEmailToken, hashEmailToken} from './tokens.ts';

type Purpose = 'signup' | 'recover';

export type EmailLinks = ReturnType<typeof createEmailLinks>;

export function createEmailLinks(db: Db, mailer: Mailer) {
    return {
        /** A link that is neither used nor expired, looked up by token hash. */
        async find(hash: string) {
            const [token] = await db
                .select()
                .from(emailTokens)
                .where(
                    and(eq(emailTokens.hash, hash), isNull(emailTokens.usedAt), gt(emailTokens.expiresAt, new Date())),
                );
            return token ?? null;
        },

        findByToken(token: string) {
            return this.find(hashEmailToken(token));
        },

        async send(origin: string, purpose: Purpose, email: string, userId: string | null) {
            const token = generateEmailToken();
            await db.insert(emailTokens).values({
                hash: hashEmailToken(token),
                purpose,
                email,
                userId,
                expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
            });
            const url = `${origin}/login?token=${token}`;
            await mailer.send(purpose === 'signup' ? authMails.signup(email, url) : authMails.recover(email, url));
        },
    };
}
