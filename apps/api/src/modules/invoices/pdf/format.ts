import type {InvoiceLang} from './labels.ts';

/** fr-FR thin spaces (thousands separator) → no-break space, which every font has. */
export function safe(s: string): string {
    return s.replace(/[\u202f\u2009\u2007]/g, '\u00a0').replace(/[\u2010\u2011]/g, '-');
}

export function formatters(lang: InvoiceLang, currency: string) {
    const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
    const money = new Intl.NumberFormat(locale, {style: 'currency', currency});
    const num = new Intl.NumberFormat(locale, {maximumFractionDigits: 2});
    const enDate = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });
    return {
        money: (cents: number) => money.format(cents / 100),
        num: (n: number) => num.format(n),
        pct: (r: number) => (lang === 'fr' ? `${num.format(r * 100)} %` : `${num.format(r * 100)}%`),
        date: (iso: string) => {
            const [y, m, d] = iso.split('-');
            return lang === 'fr' ? `${d}/${m}/${y}` : enDate.format(new Date(Date.UTC(+y, +m - 1, +d)));
        },
    };
}
