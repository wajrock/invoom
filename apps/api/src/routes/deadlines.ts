import {and, eq, gte, isNotNull, isNull, lte} from 'drizzle-orm';
import {Hono} from 'hono';
import {z} from 'zod';
import {deadlines} from '../db/schema.ts';
import type {Deps} from '../deps.ts';
import {generateDeadlines, type DeadlineKind} from '../lib/fiscal.ts';
import {notFound, parseJson, uuidParam} from '../lib/http.ts';
import {getTaxSettings, listEncaissements} from '../lib/store.ts';
import {deadlineSchema, type CustomDeadline} from '../lib/types.ts';

export interface DeadlineView {
    id: string;
    auto: boolean;
    kind: DeadlineKind;
    title: string;
    dueOn: string;
    amount: number | null;
    note: string;
    done: boolean;
    doneAt: string | null;
}

/** Échéances (auto + personnalisées) dont la date tombe entre from et to inclus. */
export async function listDeadlines(deps: Deps, from: string, to: string): Promise<DeadlineView[]> {
    const {db, cipher} = deps;
    const [tax, items] = await Promise.all([getTaxSettings(deps), listEncaissements(deps)]);
    const fromYear = Number(from.slice(0, 4));
    const toYear = Number(to.slice(0, 4));
    // Une échéance de janvier peut concerner l'année précédente (T4, décembre)
    const years = Array.from({length: toYear - fromYear + 2}, (_, i) => fromYear - 1 + i);

    const doneRows = await db.select().from(deadlines).where(isNotNull(deadlines.autoKey));
    const doneMap = new Map(doneRows.map((r) => [r.autoKey!, r.doneAt]));

    const auto: DeadlineView[] = generateDeadlines(years, items, tax)
        .filter((d) => d.dueOn >= from && d.dueOn <= to)
        .map((d) => {
            const doneAt = doneMap.get(d.autoKey) ?? null;
            return {
                id: d.autoKey,
                auto: true,
                kind: d.kind,
                title: d.title,
                dueOn: d.dueOn,
                amount: d.amount,
                note: d.note ?? '',
                done: !!doneAt,
                doneAt: doneAt?.toISOString() ?? null,
            };
        });

    const customRows = await db
        .select()
        .from(deadlines)
        .where(and(isNull(deadlines.autoKey), gte(deadlines.dueOn, from), lte(deadlines.dueOn, to)));
    const custom: DeadlineView[] = customRows.map((r) => {
        const d = cipher.decryptJson<CustomDeadline>(r.data);
        return {
            id: r.id,
            auto: false,
            kind: d.kind,
            title: d.title,
            dueOn: r.dueOn,
            amount: d.amount,
            note: d.note,
            done: !!r.doneAt,
            doneAt: r.doneAt?.toISOString() ?? null,
        };
    });

    return [...auto, ...custom].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export const deadlineRoutes = (deps: Deps) => {
    const {db, cipher} = deps;
    return (
        new Hono()
            /**
             * Échéances entre `from` et `to` (YYYY-MM-DD, inclus).
             * Par défaut : du début de l'année de création jusqu'à dans 12 mois.
             */
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
                    // Échéance automatique : on mémorise le statut via sa clé
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
