import {eq} from 'drizzle-orm';
import type {Deps} from '../../core/deps.ts';
import {clients} from '../../db/schema/index.ts';
import type {Client} from './client.schema.ts';

/** Clients saved before the country field existed: infer the code from the free-text country. */
export function guessCountryCode(country: string): Client['countryCode'] {
    const c = country.trim().toLowerCase();
    if (['france', 'fr'].includes(c)) return 'FR';
    if (['italie', 'italy', 'italia', 'it'].includes(c)) return 'IT';
    if (['allemagne', 'germany', 'deutschland', 'de'].includes(c)) return 'DE';
    return 'OTHER';
}

function decryptClient(cipher: Deps['cipher'], id: string, data: Buffer) {
    const c = cipher.decryptJson<Client>(data);
    return {id, ...c, countryCode: c.countryCode ?? guessCountryCode(c.country)};
}

export async function listClients({db, cipher}: Deps) {
    const rows = await db.select().from(clients);
    return rows.map((r) => decryptClient(cipher, r.id, r.data)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function getClient({db, cipher}: Deps, id: string) {
    const [row] = await db.select().from(clients).where(eq(clients.id, id));
    return row ? decryptClient(cipher, row.id, row.data) : null;
}
