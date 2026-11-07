import {and, eq, isNull} from 'drizzle-orm';
import {Hono} from 'hono';
import {z} from 'zod';
import {deadlines} from '../../db/schema/index.ts';
import type {Deps} from '../../core/deps.ts';
import {notFound, parseJson, uuidParam} from '../../core/http.ts';
import {getTaxSettings} from '../settings/settings.store.ts';
import {deadlineSchema} from './deadline.schema.ts';
import {listDeadlines} from './deadlines.service.ts';

export const deadlineRoutes = (deps: Deps) => {
    const {db, cipher} = deps;
    return (
        new Hono()
            /** Deadlines between `from` and `to` (inclusive); defaults to the start year up to 12 months ahead. */
            .get('/', async (c) => {
                const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
                const tax = await getTaxSettings(deps);
                const inOneYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
                const from = c.req.query('from') ?? `${tax.activityStart.slice(0, 4)}-01-01`;
                const to = c.req.query('to') ?? inOneYear;
                if (!isoDate.safeParse(from).success || !isoDate.safeParse(to).success || from > to) {
                    return c.json({error: 'Période invalide'}, 400);
                }
                if (Number(to.slice(0, 4)) - Number(from.slice(0, 4)) > 15)
                    return c.json({error: 'Période trop longue (15 ans max)'}, 400);
                return c.json(await listDeadlines(deps, from, to));
            })
            .post('/', async (c) => {
                const body = await parseJson(c, deadlineSchema);
                const [row] = await db
                    .insert(deadlines)
                    .values({dueOn: body.dueOn, data: cipher.encryptJson(body)})
                    .returning();
                return c.json({id: row.id}, 201);
            })
            .put('/status', async (c) => {
                const {id, done} = await parseJson(c, z.object({id: z.string().min(1).max(100), done: z.boolean()}));
                const doneAt = done ? new Date() : null;
                if (/^[a-z-]+:\d{4}(-(Q[1-4]|\d{2}))?$/.test(id)) {
                    // Generated deadlines only store their status, keyed by period
                    await db
                        .insert(deadlines)
                        .values({autoKey: id, dueOn: '1970-01-01', doneAt, data: cipher.encryptJson({})})
                        .onConflictDoUpdate({target: [deadlines.workspaceId, deadlines.autoKey], set: {doneAt}});
                } else {
                    const res = await db
                        .update(deadlines)
                        .set({doneAt})
                        .where(and(eq(deadlines.id, z.uuid().parse(id)), isNull(deadlines.autoKey)))
                        .returning({id: deadlines.id});
                    if (!res.length) notFound();
                }
                return c.json({ok: true});
            })
            .put('/:id', async (c) => {
                const id = uuidParam(c);
                const body = await parseJson(c, deadlineSchema);
                const res = await db
                    .update(deadlines)
                    .set({dueOn: body.dueOn, data: cipher.encryptJson(body)})
                    .where(and(eq(deadlines.id, id), isNull(deadlines.autoKey)))
                    .returning({id: deadlines.id});
                if (!res.length) notFound();
                return c.json({ok: true});
            })
            .delete('/:id', async (c) => {
                await db.delete(deadlines).where(and(eq(deadlines.id, uuidParam(c)), isNull(deadlines.autoKey)));
                return c.body(null, 204);
            })
    );
};
