import {eq} from 'drizzle-orm';
import type {Deps} from '../../core/deps.ts';
import {settings} from '../../db/schema/index.ts';
import {defaultTaxSettings, normalizeTaxSettings, type TaxSettings} from '../fiscal/index.ts';

/** Encrypted key/value settings of the current workspace. */
export async function getSetting<T>({db, cipher}: Deps, key: string, fallback: () => T): Promise<T> {
    const [row] = await db.select().from(settings).where(eq(settings.key, key));
    return row ? cipher.decryptJson<T>(row.data) : fallback();
}

export async function putSetting({db, cipher}: Deps, key: string, value: unknown) {
    const data = cipher.encryptJson(value);
    await db
        .insert(settings)
        .values({key, data})
        .onConflictDoUpdate({target: [settings.workspaceId, settings.key], set: {data, updatedAt: new Date()}});
}

export const getTaxSettings = async (deps: Deps): Promise<TaxSettings> =>
    normalizeTaxSettings(await getSetting<TaxSettings>(deps, 'tax', () => defaultTaxSettings()));
