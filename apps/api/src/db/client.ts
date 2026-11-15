import {drizzle} from 'drizzle-orm/postgres-js';
import {migrate} from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import {fileURLToPath} from 'node:url';
import * as schema from './schema/index.ts';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export function createDb(url: string) {
    const sql = postgres(url, {max: 5, onnotice: () => {}});
    const db = drizzle(sql, {schema});
    return {
        db,
        close: () => sql.end({timeout: 5}),
        migrate: () => migrate(db, {migrationsFolder}),
    };
}

export type Db = ReturnType<typeof createDb>['db'];

/**
 * Postgres running in-process and stored in a local folder (PGlite), for the demo mode: no Docker, same migrations,
 * roles and row-level security. Imported on demand: it is a development dependency, absent from production.
 */
export async function createLocalDb(dir: string) {
    const [{PGlite}, {drizzle: drizzleLite}, {migrate: migrateLite}] = await Promise.all([
        import('@electric-sql/pglite'),
        import('drizzle-orm/pglite'),
        import('drizzle-orm/pglite/migrator'),
    ]);
    const client = new PGlite(dir);
    const db = drizzleLite(client, {schema});
    return {
        // Same query builder; only raw `execute` results differ in shape (see rowsOf)
        db: db as unknown as Db,
        close: () => client.close(),
        migrate: () => migrateLite(db, {migrationsFolder}),
    };
}

/** Rows of a raw `db.execute` result: an array with Postgres.js, `{rows}` with PGlite. */
export function rowsOf<T>(result: unknown): T[] {
    return (Array.isArray(result) ? result : (result as {rows: T[]}).rows) as T[];
}
