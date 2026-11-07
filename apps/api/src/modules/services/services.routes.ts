import {eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {services} from '../../db/schema/index.ts';
import type {Deps} from '../../core/deps.ts';
import {notFound, parseJson, uuidParam} from '../../core/http.ts';
import {serviceSchema, type Service} from './service.schema.ts';

/** Reusable invoice lines offered by the invoice generator. */
export const serviceRoutes = ({db, cipher}: Deps) =>
    new Hono()
        .get('/', async (c) => {
            const rows = await db.select().from(services);
            return c.json(
                rows
                    .map((r) => {
                        const data = cipher.decryptJson<Service>(r.data);
                        return {id: r.id, ...data, clientId: data.clientId ?? null};
                    })
                    .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
            );
        })
        .post('/', async (c) => {
            const body = await parseJson(c, serviceSchema);
            const [row] = await db
                .insert(services)
                .values({data: cipher.encryptJson(body)})
                .returning({id: services.id});
            return c.json({id: row.id, ...body}, 201);
        })
        .put('/:id', async (c) => {
            const id = uuidParam(c);
            const body = await parseJson(c, serviceSchema);
            const res = await db
                .update(services)
                .set({data: cipher.encryptJson(body)})
                .where(eq(services.id, id))
                .returning({id: services.id});
            if (!res.length) notFound();
            return c.json({id, ...body});
        })
        // Issued invoices hold a copy of their lines and are not affected
        .delete('/:id', async (c) => {
            await db.delete(services).where(eq(services.id, uuidParam(c)));
            return c.body(null, 204);
        });
