import {Hono} from 'hono';
import {z} from 'zod';
import type {Deps} from '../../core/deps.ts';
import {cents} from '../../core/validation.ts';
import {simulateFromGross, simulateFromNet} from '../fiscal/index.ts';
import {getTaxSettings} from '../settings/settings.store.ts';

const query = z.object({
    amount: z.coerce.number().pipe(cents),
    /** `gross`: amount invoiced → net; `net`: target net → amount to invoice */
    from: z.enum(['gross', 'net']),
});

export const simulatorRoutes = (deps: Deps) =>
    new Hono().get('/', async (c) => {
        const parsed = query.safeParse(c.req.query());
        if (!parsed.success) return c.json({error: 'Montant invalide'}, 400);
        const {amount, from} = parsed.data;
        const tax = await getTaxSettings(deps);
        const today = new Date().toISOString().slice(0, 10);
        try {
            return c.json(
                from === 'gross' ? simulateFromGross(amount, tax, today) : simulateFromNet(amount, tax, today),
            );
        } catch {
            return c.json({error: 'Tes taux de charges atteignent 100 % : vérifie tes paramètres fiscaux'}, 400);
        }
    });
