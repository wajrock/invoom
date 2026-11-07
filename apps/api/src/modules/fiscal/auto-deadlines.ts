import {firstDayOfMonth, lastDayOfMonth, nextBusinessDay, pad} from './calendar.ts';
import {computeCharges, computeYear, isCfeExempt, type Encaissement} from './charges.ts';
import {annualPeriod, type TaxSettings} from './tax-settings.ts';

export type DeadlineKind = 'urssaf' | 'cfe' | 'impot' | 'autre';

export interface AutoDeadline {
    autoKey: string;
    kind: DeadlineKind;
    title: string;
    dueOn: string;
    /** Estimated amount, null when unknown */
    amount: number | null;
    /** Period covered (URSSAF declarations) */
    periodStart?: string;
    periodEnd?: string;
    note?: string;
}

const MONTHS_FR = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
];

const EUR = new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR'});

const eur = (cents: number) => EUR.format(cents / 100);

/** "2026-10-01" → "1er octobre 2026" (used in French deadline titles). */
function frDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d === 1 ? '1er' : d} ${MONTHS_FR[m - 1]} ${y}`;
}

/**
 * End of the period covered by the first URSSAF declaration. It is due after the quarter
 * (or month) following the 90th day of activity and covers everything since the start.
 * E.g. start on Oct 1, 2026 (quarterly): day 90 is late December → period ends March 31, 2027.
 */
export function firstDeclarationEnd(s: TaxSettings): string {
    const [y, m, d] = s.activityStart.split('-').map(Number);
    const day90 = new Date(Date.UTC(y, m - 1, d + 90));
    const year = day90.getUTCFullYear();
    const month0 = day90.getUTCMonth();
    const startYear = Number(s.activityStart.slice(0, 4));
    if (annualPeriod(s, startYear).declarationFrequency === 'monthly') return lastDayOfMonth(year, month0 + 1);
    const quarter = Math.floor(month0 / 3);
    return lastDayOfMonth(year, (quarter + 1) * 3 + 2);
}

export function generateDeadlines(years: number[], items: Encaissement[], s: TaxSettings): AutoDeadline[] {
    const out: AutoDeadline[] = [];
    const startYear = Number(s.activityStart.slice(0, 4));

    const sumBetween = (from: string, to: string) =>
        computeCharges(
            items.filter((p) => p.paidOn >= from && p.paidOn <= to),
            s,
        );

    const firstEnd = firstDeclarationEnd(s);

    for (const year of years) {
        if (year < startYear) continue;
        const annual = annualPeriod(s, year);

        // URSSAF declarations (revenue, contributions and VL when enabled)
        const monthly = annual.declarationFrequency === 'monthly';
        const count = monthly ? 12 : 4;
        for (let i = 0; i < count; i++) {
            const periodStart = monthly ? firstDayOfMonth(year, i) : firstDayOfMonth(year, i * 3);
            const periodEnd = monthly ? lastDayOfMonth(year, i) : lastDayOfMonth(year, i * 3 + 2);
            // Periods before the end of the first declaration are folded into it
            if (periodEnd < firstEnd) continue;
            const isFirst = periodEnd === firstEnd;
            const from = isFirst ? s.activityStart : periodStart;
            const c = sumBetween(from, periodEnd);
            // French elision before a vowel: « d’avril », « d’août », « d’octobre »
            const de = /^[aeiouéèâ]/i.test(MONTHS_FR[i]) ? 'd’' : 'de ';
            const label = monthly ? `${de}${MONTHS_FR[i]} ${year}` : `du T${i + 1} ${year}`;
            out.push({
                autoKey: monthly ? `urssaf:${year}-${pad(i + 1)}` : `urssaf:${year}-Q${i + 1}`,
                kind: 'urssaf',
                title: isFirst
                    ? `Première déclaration URSSAF (du ${frDate(s.activityStart)} au ${frDate(periodEnd)})`
                    : `Déclaration URSSAF ${label}`,
                // URSSAF moves due dates falling on a weekend or holiday to the next business day
                dueOn: nextBusinessDay(monthly ? lastDayOfMonth(year, i + 1) : lastDayOfMonth(year, i * 3 + 3)),
                amount: c.urssaf,
                periodStart: from,
                periodEnd,
                note: isFirst
                    ? `CA à déclarer : ${eur(c.ca)}. La 1re déclaration couvre toute la période depuis le début d’activité (règle des 90 jours) : vérifie la date sur ton espace URSSAF.`
                    : `CA à déclarer : ${eur(c.ca)}`,
            });
        }

        // CFE: initial declaration in the first year, then payment on December 15
        if (year === startYear) {
            out.push({
                autoKey: `cfe-decl:${year}`,
                kind: 'cfe',
                title: 'Déclaration initiale CFE (formulaire 1447-C-SD)',
                dueOn: `${year}-12-31`,
                amount: null,
                note: 'À faire sur impots.gouv.fr (espace professionnel) l’année de création.',
            });
        }
        if (!isCfeExempt(year, s)) {
            out.push({
                autoKey: `cfe:${year}`,
                kind: 'cfe',
                title: `Paiement CFE ${year}`,
                dueOn: `${year}-12-15`,
                amount: annual.cfeAmount || null,
                note: 'Avis disponible dans l’espace professionnel impots.gouv.fr (mi-novembre).',
            });
        }

        // Income tax return (previous year's revenue on form 2042-C-PRO)
        if (year - 1 >= startYear) {
            const prev = computeYear(year - 1, items, s);
            const allUnderVl = prev.ca > 0 && prev.caUnderVl === prev.ca;
            const partlyUnderVl = prev.caUnderVl > 0 && !allUnderVl;
            out.push({
                autoKey: `ir:${year}`,
                kind: 'impot',
                title: `Déclaration de revenus ${year} (CA ${year - 1})`,
                dueOn: `${year}-05-31`,
                amount: allUnderVl ? null : prev.incomeTaxEstimate,
                note: `Déclarer ${eur(prev.ca)} de CA sur la 2042-C-PRO. Date limite exacte selon votre département (fin mai / début juin).${
                    allUnderVl ? ' Impôt déjà payé via le versement libératoire.' : ''
                }${
                    partlyUnderVl
                        ? ` Dont ${eur(prev.caUnderVl)} sous versement libératoire (impôt déjà payé sur cette part).`
                        : ''
                }`,
            });
        }
    }

    return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}
