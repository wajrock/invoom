import type {Context} from 'hono';
import type {Mailer} from '../../core/mailer.ts';
import type {Db} from '../../db/client.ts';
import type {WorkspaceRuntime} from '../../db/workspace-scope.ts';
import {createChallenges, type Challenges} from './challenges.ts';
import {createEmailLinks, type EmailLinks} from './email-links.ts';
import {createRateLimiter, type RateLimiter} from './rate-limit.ts';
import {createRecoveryCodes, type RecoveryCodes} from './recovery-codes.ts';
import {clientIp} from './request.ts';
import {createSessions, type Sessions} from './sessions.ts';

export interface AuthOptions {
    db: Db;
    workspaces: WorkspaceRuntime;
    mailer: Mailer;
    secureCookies: boolean;
    trustProxy: boolean;
}

/** Everything the auth routes share. */
export interface AuthContext {
    db: Db;
    workspaces: WorkspaceRuntime;
    ip: (c: Context) => string;
    limiter: RateLimiter;
    sessions: Sessions;
    challenges: Challenges;
    recoveryCodes: RecoveryCodes;
    emailLinks: EmailLinks;
}

export function createAuthContext(opts: AuthOptions): AuthContext {
    const ip = (c: Context) => clientIp(c, opts.trustProxy);
    return {
        db: opts.db,
        workspaces: opts.workspaces,
        ip,
        limiter: createRateLimiter(opts.db, ip),
        sessions: createSessions(opts.db, opts.secureCookies),
        challenges: createChallenges(opts.db),
        recoveryCodes: createRecoveryCodes(opts.db),
        emailLinks: createEmailLinks(opts.db, opts.mailer),
    };
}
