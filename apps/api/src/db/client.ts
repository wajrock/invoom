import {drizzle} from 'drizzle-orm/postgres-js';
import {migrate} from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import {fileURLToPath} from 'node:url';
import * as schema from './schema.ts';

export function createDb(url: string) {
    const sql = postgres(url, {max: 5, onnotice: () => {}});
    const db = drizzle(sql, {schema});
    return {
        db,
        sql,
        migrate: () => migrate(db, {migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url))}),
    };
}

export type Db = ReturnType<typeof createDb>['db'];
