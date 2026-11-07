import {eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {clients} from '../db/schema.ts';
import type {Deps} from '../deps.ts';
import {notFound, parseJson, uuidParam} from '../lib/http.ts';
import {listClients} from '../lib/store.ts';
import {clientSchema} from '../lib/types.ts';

export const clientRoutes = (deps: Deps) => {
    const {db, cipher} = deps;
    return (
        new Hono()
            .get('/', async (c) => c.json(await listClients(deps)))
            .post('/', async (c) => {
                const body = await parseJson(c, clientSchema);
                const [row] = await db
                    .insert(clients)
                    .values({data: cipher.encryptJson(body)})
                    .returning({id: clients.id});
                return c.json({id: row.id, ...body}, 201);
            })
            .put('/:id', async (c) => {
                const id = uuidParam(c);
                const body = await parseJson(c, clientSchema);
                const res = await db
                    .update(clients)
                    .set({data: cipher.encryptJson(body)})
                    .where(eq(clients.id, id))
                    .returning({id: clients.id});
                if (!res.length) notFound();
                return c.json({id, ...body});
            })
            // Les factures déjà émises gardent une copie figée des coordonnées du client
            .delete('/:id', async (c) => {
                await db.delete(clients).where(eq(clients.id, uuidParam(c)));
                return c.body(null, 204);
            })
    );
};
