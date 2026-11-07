import {Hono} from 'hono';
import type {Deps} from '../deps.ts';
import {annualPeriod, computeYear} from '../lib/fiscal.ts';
import {getTaxSettings, listEncaissements, listPayments} from '../lib/store.ts';
import {listDeadlines} from './deadlines.ts';

const monthly = (items: {amount: number; paidOn: string}[], year: number) => {
    const out = Array<number>(12).fill(0);
    for (const p of items) if (p.paidOn.startsWith(`${year}-`)) out[Number(p.paidOn.slice(5, 7)) - 1] += p.amount;
    return out;
};

export const dashboardRoutes = (deps: Deps) =>
    new Hono().get('/', async (c) => {
        const year = Number(c.req.query('year') ?? new Date().getFullYear());
        if (!Number.isInteger(year) || year < 2000 || year > 2100) return c.json({error: 'Année invalide'}, 400);

        const [tax, items, all] = await Promise.all([
            getTaxSettings(deps),
            listEncaissements(deps),
            listPayments(deps),
        ]);
        const today = new Date().toISOString().slice(0, 10);
        const in6Months = new Date(Date.now() + 183 * 864e5).toISOString().slice(0, 10);
        const lastYear = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);

        const deadlines = await listDeadlines(deps, lastYear, in6Months);
        const pending = all.filter((p) => !p.paidOn);
        const years = [...new Set(items.map((p) => Number(p.paidOn.slice(0, 4))))].sort();

        return c.json({
            year,
            years,
            monthly: monthly(items, year),
            previousMonthly: monthly(items, year - 1),
            summary: computeYear(year, items, tax),
            previous: computeYear(year - 1, items, tax),
            // Paramètres annuels : ceux en vigueur au 31 décembre de l'année affichée
            thresholds: {
                caCeiling: annualPeriod(tax, year).caCeiling,
                tvaThreshold: annualPeriod(tax, year).tvaThreshold,
            },
            settings: {
                declarationFrequency: annualPeriod(tax, year).declarationFrequency,
                /** Nombre de périodes de taux qui s'appliquent pendant l'année */
                periodsInYear: tax.periods.filter((p, i) => {
                    const next = tax.periods[i + 1];
                    return (i === 0 || p.from <= `${year}-12-31`) && (!next || next.from > `${year}-01-01`);
                }).length,
            },
            // Échéances non réglées : en retard + à venir
            upcoming: deadlines.filter((d) => !d.done).slice(0, 8),
            today,
            pending: {count: pending.length, amount: pending.reduce((s, p) => s + p.amount, 0)},
        });
    });
