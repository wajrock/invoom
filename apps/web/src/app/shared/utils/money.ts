/** All amounts exchanged with the API are in euro cents. */

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'];

const eur = new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR'});
const eurRound = new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});

/** Cents → "1 234,56 €" */
export function formatCents(cents: number | null | undefined, round = false): string {
    if (cents === null || cents === undefined) return '—';
    return (round ? eurRound : eur).format(cents / 100);
}

export function formatMoney(cents: number, currency: string): string {
    try {
        return new Intl.NumberFormat('fr-FR', {style: 'currency', currency}).format(cents / 100);
    } catch {
        return `${(cents / 100).toFixed(2)} ${currency}`;
    }
}

/** "1 234,56" or "1234.56" → cents (null when empty or invalid) */
export function parseEuros(input: string | number | null | undefined): number | null {
    if (input === null || input === undefined) return null;
    // \u202f: narrow no-break space used by Intl as the fr-FR thousands separator
    const s = String(input)
        .replace(/[\s\u202f€]/g, '')
        .replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Cents → "1234,56" for an input field */
export function centsToInput(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return '';
    return (cents / 100).toFixed(2).replace('.', ',');
}

/** "20,5 %" → 0.205, keeping `decimals` digits of the percentage (null when empty or outside 0–100). */
export function parsePercent(input: string, decimals: number): number | null {
    const s = input.replace(/[\s%]/g, '').replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    const f = 10 ** decimals;
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * f) / (100 * f) : null;
}

/** 0.205 → "20,5" for an input field */
export function percentToInput(rate: number, decimals: number): string {
    const f = 10 ** decimals;
    return String(Math.round(rate * (100 * f)) / f).replace('.', ',');
}
