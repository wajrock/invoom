import {AsyncLocalStorage} from 'node:async_hooks';
import {randomBytes} from 'node:crypto';
import {eq, sql} from 'drizzle-orm';
import type {Deps} from '../core/deps.ts';
import {createCipher, type Cipher} from '../core/crypto.ts';
import type {Db} from './client.ts';
import {WORKSPACE_TABLES, workspaces} from './schema/index.ts';

/**
 * Workspace data isolation.
 *
 * Every authenticated request runs in a transaction that:
 *  1. sets `app.workspace_id`, read by the row-level security policies and column defaults;
 *  2. switches to the `invoom_app` role, which cannot bypass row-level security.
 * Business routes use relay `Deps` pointing at that transaction and at the workspace's encryption
 * key, so they never filter by workspace themselves.
 */

interface WorkspaceScope {
    db: Db;
    cipher: Cipher;
    workspaceId: string;
    userId: string;
}

const scope = new AsyncLocalStorage<WorkspaceScope>();

export function currentScope(): WorkspaceScope {
    const s = scope.getStore();
    if (!s) throw new Error('Accès aux données hors d’un espace de travail');
    return s;
}

/** An object whose properties are read from the current value at call time. */
function relay<T extends object>(target: () => T): T {
    return new Proxy({} as T, {
        get(_, prop) {
            const t = target();
            const value = Reflect.get(t, prop, t);
            return typeof value === 'function' ? value.bind(t) : value;
        },
    });
}

/** Business route dependencies, bound to the current request's workspace. */
export const scopedDeps: Deps = {
    db: relay(() => currentScope().db),
    cipher: relay(() => currentScope().cipher),
};

const APP_ROLE = 'invoom_app';

export interface WorkspaceRuntime {
    run<T>(ctx: {workspaceId: string; userId: string}, fn: () => Promise<T>): Promise<T>;
    /** Creates a workspace with its own data key, encrypted with the master key. */
    createWorkspace(db: Db): Promise<string>;
}

/**
 * Sets up isolation at startup: grants the restricted role access, and refuses to start when the
 * connection would bypass row-level security without being able to switch to that role.
 */
export async function createWorkspaceRuntime(db: Db, master: Cipher): Promise<WorkspaceRuntime> {
    const [{hasRole}] = (await db.execute(
        sql`select exists(select 1 from pg_roles where rolname = ${APP_ROLE}) as "hasRole"`,
    )) as unknown as {hasRole: boolean}[];
    let useRole = false;
    if (hasRole) {
        const tables = sql.raw(WORKSPACE_TABLES.map((t) => `"${t}"`).join(', '));
        await db.execute(sql`grant usage on schema public to ${sql.identifier(APP_ROLE)}`);
        await db.execute(sql`grant select, insert, update, delete on ${tables} to ${sql.identifier(APP_ROLE)}`);
        await db.transaction(async (tx) => {
            await tx.execute(sql`set local role ${sql.identifier(APP_ROLE)}`);
        });
        useRole = true;
    } else {
        const [me] = (await db.execute(
            sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
        )) as unknown as {rolsuper: boolean; rolbypassrls: boolean}[];
        if (me?.rolsuper || me?.rolbypassrls) {
            throw new Error(
                `Isolation impossible : l'utilisateur Postgres contourne la RLS et le rôle ${APP_ROLE} n'existe pas. ` +
                    `Crée-le (CREATE ROLE ${APP_ROLE} NOLOGIN; GRANT ${APP_ROLE} TO <utilisateur>;) ou utilise un compte sans privilège.`,
            );
        }
    }

    const ciphers = new Map<string, Cipher>();
    async function cipherFor(workspaceId: string): Promise<Cipher> {
        const cached = ciphers.get(workspaceId);
        if (cached) return cached;
        const [ws] = await db
            .select({dataKey: workspaces.dataKey})
            .from(workspaces)
            .where(eq(workspaces.id, workspaceId));
        if (!ws) throw new Error('Espace introuvable');
        const cipher = createCipher(master.decrypt(ws.dataKey).toString('base64'));
        ciphers.set(workspaceId, cipher);
        return cipher;
    }

    return {
        async run(ctx, fn) {
            const cipher = await cipherFor(ctx.workspaceId);
            return db.transaction(async (tx) => {
                await tx.execute(sql`select set_config('app.workspace_id', ${ctx.workspaceId}, true)`);
                if (useRole) await tx.execute(sql`set local role ${sql.identifier(APP_ROLE)}`);
                return scope.run({db: tx as unknown as Db, cipher, ...ctx}, fn);
            });
        },
        async createWorkspace(conn) {
            const [ws] = await conn
                .insert(workspaces)
                .values({dataKey: master.encrypt(randomBytes(32))})
                .returning({id: workspaces.id});
            return ws.id;
        },
    };
}
