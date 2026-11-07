import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { services } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { notFound, parseJson, uuidParam } from '../lib/http.ts';
import { serviceSchema, type Service } from '../lib/types.ts';

/** Catalogue de prestations réutilisables dans le générateur de factures. */
export const serviceRoutes = ({ db, cipher }: Deps) =>
  new Hono()
    .get('/', async (c) => {
      const rows = await db.select().from(services);
      return c.json(
        rows
          .map((r) => {
            const data = cipher.decryptJson<Service>(r.data);
            return { id: r.id, ...data, clientId: data.clientId ?? null };
          })
          .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
      );
    })
    .post('/', async (c) => {
      const body = await parseJson(c, serviceSchema);
      const [row] = await db.insert(services).values({ data: cipher.encryptJson(body) }).returning({ id: services.id });
      return c.json({ id: row.id, ...body }, 201);
    })
    .put('/:id', async (c) => {
      const id = uuidParam(c);
      const body = await parseJson(c, serviceSchema);
      const res = await db
        .update(services)
        .set({ data: cipher.encryptJson(body) })
        .where(eq(services.id, id))
        .returning({ id: services.id });
      if (!res.length) notFound();
      return c.json({ id, ...body });
    })
    // Les factures déjà émises contiennent une copie de leurs lignes : elles ne sont pas affectées
    .delete('/:id', async (c) => {
      await db.delete(services).where(eq(services.id, uuidParam(c)));
      return c.body(null, 204);
    });
