import {asc, eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {z} from 'zod';
import {platforms} from '../db/schema.ts';
import type {Deps} from '../deps.ts';
import {notFound, parseJson, uuidParam} from '../lib/http.ts';
import {platformSchema, type Platform} from '../lib/types.ts';

const DEFAULT_PLATFORMS: Platform[] = [
    {
        name: 'URSSAF auto-entrepreneur',
        url: 'https://www.autoentrepreneur.urssaf.fr',
        category: 'Administratif',
        description: 'Déclarations de CA et paiement des cotisations',
        login: '',
    },
    {
        name: 'impots.gouv – Professionnel',
        url: 'https://cfspro.impots.gouv.fr',
        category: 'Administratif',
        description: 'CFE, messagerie pro',
        login: '',
    },
    {
        name: 'impots.gouv – Particulier',
        url: 'https://cfspart.impots.gouv.fr',
        category: 'Administratif',
        description: 'Déclaration de revenus (2042-C-PRO)',
        login: '',
    },
    {
        name: 'Annuaire des entreprises',
        url: 'https://annuaire-entreprises.data.gouv.fr',
        category: 'Administratif',
        description: 'Extrait SIRENE / avis de situation',
        login: '',
    },
    {
        name: 'Guichet unique INPI',
        url: 'https://procedures.inpi.fr',
        category: 'Administratif',
        description: 'Modifications de l’entreprise',
        login: '',
    },
];

export const platformRoutes = ({db, cipher}: Deps) => {
    const list = async () => {
        let rows = await db.select().from(platforms).orderBy(asc(platforms.position), asc(platforms.createdAt));
        if (rows.length === 0) {
            await db
                .insert(platforms)
                .values(DEFAULT_PLATFORMS.map((p, i) => ({position: i, data: cipher.encryptJson(p)})));
            rows = await db.select().from(platforms).orderBy(asc(platforms.position), asc(platforms.createdAt));
        }
        return rows.map((r) => ({id: r.id, position: r.position, ...cipher.decryptJson<Platform>(r.data)}));
    };

    return new Hono()
        .get('/', async (c) => c.json(await list()))
        .post('/', async (c) => {
            const body = await parseJson(c, platformSchema);
            const count = (await db.select({id: platforms.id}).from(platforms)).length;
            const [row] = await db
                .insert(platforms)
                .values({position: count, data: cipher.encryptJson(body)})
                .returning();
            return c.json({id: row.id, position: row.position, ...body}, 201);
        })
        .put('/order', async (c) => {
            const {ids} = await parseJson(c, z.object({ids: z.array(z.uuid()).max(500)}));
            await db.transaction(async (tx) => {
                for (const [i, id] of ids.entries())
                    await tx.update(platforms).set({position: i}).where(eq(platforms.id, id));
            });
            return c.json(await list());
        })
        .put('/:id', async (c) => {
            const id = uuidParam(c);
            const body = await parseJson(c, platformSchema);
            const res = await db
                .update(platforms)
                .set({data: cipher.encryptJson(body)})
                .where(eq(platforms.id, id))
                .returning();
            if (!res.length) notFound();
            return c.json({id, position: res[0].position, ...body});
        })
        .delete('/:id', async (c) => {
            await db.delete(platforms).where(eq(platforms.id, uuidParam(c)));
            return c.body(null, 204);
        });
};
