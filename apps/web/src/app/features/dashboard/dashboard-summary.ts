import {formatCents} from '../../shared/utils/money';
import type {Dashboard} from './dashboard.models';

export const MONTHS = [
    'janv.',
    'févr.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sept.',
    'oct.',
    'nov.',
    'déc.',
];

export interface SummaryRow {
    label: string;
    value: string;
    strong?: boolean;
}

/** Change vs last year, over the same months for the current year (null when there is no reference). */
export function growth(d: Dashboard, now = new Date()) {
    const partial = d.year === now.getFullYear();
    const months = partial ? now.getMonth() + 1 : 12;
    const sum = (arr: number[]) => arr.slice(0, months).reduce((s, v) => s + v, 0);
    const cur = sum(d.monthly);
    const prev = sum(d.previousMonthly);
    if (prev === 0) return null;
    const value = (cur - prev) / prev;
    const label = `${value >= 0 ? '+' : ''}${Math.round(value * 100)} %`;
    return {value, label, period: partial ? `${MONTHS[0]}–${MONTHS[months - 1]} ${d.year - 1}` : `${d.year - 1}`};
}

export function thresholds(d: Dashboard) {
    return [
        {label: 'Franchise de TVA', limit: d.thresholds.tvaThreshold},
        {label: 'Plafond micro-entreprise', limit: d.thresholds.caCeiling},
    ].map((t) => {
        const ratio = t.limit > 0 ? d.summary.ca / t.limit : 0;
        return {
            ...t,
            pct: Math.round(ratio * 100),
            bar: Math.min(100, ratio * 100),
            remaining: Math.max(0, t.limit - d.summary.ca),
            color: ratio >= 1 ? 'bg-destructive' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-primary',
        };
    });
}

/** The income-tax estimate is shown unless all the revenue is covered by the "versement libératoire" */
const hasIncomeTaxEstimate = (d: Dashboard) => d.summary.ca > d.summary.caUnderVl || d.summary.vl === 0;

/** Taxes of the year: income tax (estimate and/or VL) + CFE */
export function taxes(d: Dashboard): {total: number; lines: SummaryRow[]} {
    const s = d.summary;
    const lines: SummaryRow[] = [];
    if (hasIncomeTaxEstimate(d))
        lines.push({label: 'Impôt sur le revenu (estimé)', value: formatCents(s.incomeTaxEstimate, true)});
    if (s.vl > 0) lines.push({label: 'Versement libératoire', value: formatCents(s.vl, true)});
    lines.push({label: 'CFE', value: s.cfeExempt ? 'exonérée' : formatCents(s.cfe, true)});
    return {total: s.incomeTaxEstimate + s.vl + s.cfe, lines};
}

/** From revenue to estimated net income */
export function breakdown(d: Dashboard): SummaryRow[] {
    const s = d.summary;
    const rows: SummaryRow[] = [
        {label: 'CA encaissé', value: formatCents(s.ca)},
        {label: 'Cotisations sociales (URSSAF)', value: '− ' + formatCents(s.social)},
    ];
    if (hasIncomeTaxEstimate(d))
        rows.push({label: 'Impôt sur le revenu (estimé)', value: '− ' + formatCents(s.incomeTaxEstimate)});
    if (s.vl > 0) rows.push({label: 'Versement libératoire', value: '− ' + formatCents(s.vl)});
    rows.push({label: s.cfeExempt ? 'CFE (exonérée)' : 'CFE', value: '− ' + formatCents(s.cfe)});
    rows.push({label: 'Net estimé', value: formatCents(s.net), strong: true});
    return rows;
}

/** Share of the revenue, e.g. "21,2 %" */
export function rateOfCa(d: Dashboard, cents: number): string {
    const ca = d.summary.ca;
    return ca > 0 ? `${((cents / ca) * 100).toLocaleString('fr-FR', {maximumFractionDigits: 1})} %` : '0 %';
}
