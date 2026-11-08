import {Hono} from 'hono';
import {z} from 'zod';
import type {Deps} from '../../core/deps.ts';
import {cents} from '../../core/validation.ts';
import {
    ACTIVITY_LABELS,
    type Activity,
    defaultPeriod,
    simulateFromGross,
    simulateFromNet,
    type TaxSettings,
} from '../fiscal/index.ts';
import {getTaxSettings} from '../settings/settings.store.ts';

const rate = z.coerce.number().min(0).max(1);

const query = z.discriminatedUnion('rates', [
    z.object({
        amount: z.coerce.number().pipe(cents),
        /** `gross`: amount invoiced → net; `net`: target net → amount to invoice */
        from: z.enum(['gross', 'net']),
        rates: z.literal('saved').default('saved'),
    }),
    z.object({
        amount: z.coerce.number().pipe(cents),
        from: z.enum(['gross', 'net']),
        rates: z.literal('custom'),
        activity: z.enum(Object.keys(ACTIVITY_LABELS) as [Activity, ...Activity[]]),
        social: rate,
        vlOn: z.enum(['true', 'false']).transform((v) => v === 'true'),
        vl: rate,
        incomeTaxRate: rate,
    }),
]);

/** Settings with a single period built from rates typed in the simulator; no CFE. */
function customSettings(q: Extract<z.infer<typeof query>, {rates: 'custom'}>, today: string): TaxSettings {
    return {
        activity: q.activity,
        activityStart: today,
        cfeExemptFirstYear: true,
        periods: [
            {
                ...defaultPeriod(q.activity, today),
                rates: {social: q.social, vl: q.vl},
                versementLiberatoire: q.vlOn,
                incomeTaxRate: q.incomeTaxRate,
            },
        ],
    };
}

export const simulatorRoutes = (deps: Deps) =>
    new Hono().get('/', async (c) => {
        const raw = c.req.query();
        const parsed = query.safeParse({rates: 'saved', ...raw});
        if (!parsed.success) return c.json({error: 'Montant ou taux invalide'}, 400);
        const q = parsed.data;
        const today = new Date().toISOString().slice(0, 10);
        const tax = q.rates === 'custom' ? customSettings(q, today) : await getTaxSettings(deps);
        try {
            return c.json(
                q.from === 'gross' ? simulateFromGross(q.amount, tax, today) : simulateFromNet(q.amount, tax, today),
            );
        } catch {
            return c.json({error: 'Les taux de charges atteignent 100 %'}, 400);
        }
    });
