/** Local date → "2026-03-15" */
export function isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso(): string {
    return isoDate(new Date());
}

/** Same day, `n` months from today */
export function inMonths(n: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() + n);
    return isoDate(d);
}

export function addDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(to) - Date.parse(from)) / 864e5);
}

/** "2026-03-15" → "15 mars 2026" */
export function formatDate(iso: string | null | undefined, style: 'long' | 'short' = 'long'): string {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: style === 'long' ? 'long' : 'short',
        year: 'numeric',
    });
}

/** Service period, compact: "1–31 oct. 2026", "15 oct. – 14 nov. 2026", "15 déc. 2025 – 14 janv. 2026" */
export function formatPeriod(from: string | null | undefined, to: string | null | undefined): string {
    if (!from && !to) return '';
    if (!from) return `jusqu’au ${formatDate(to, 'short')}`;
    if (!to) return `dès le ${formatDate(from, 'short')}`;
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    const month = (iso: string) => formatDate(iso, 'short').replace(/ \d{4}$/, '');
    if (fy === ty && fm === tm) return `${fd}–${formatDate(to, 'short')}`;
    if (fy === ty) return `${month(from)} – ${formatDate(to, 'short')}`;
    return `${formatDate(from, 'short')} – ${formatDate(to, 'short')}`;
}

/** Days from today to the date (negative when past) */
export function daysUntil(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    const target = new Date(y, m - 1, d).getTime();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((target - today) / 864e5);
}

export function relativeDays(iso: string): string {
    const n = daysUntil(iso);
    if (n === 0) return "aujourd'hui";
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return n > 0 ? `dans ${n} j` : `il y a ${-n} j`;
}

export interface MonthGroup<T> {
    /** "2026-03" */
    key: string;
    /** "mars 2026" */
    label: string;
    items: T[];
}

/** Groups items by month, keeping their order. */
export function groupByMonth<T>(items: T[], dateOf: (item: T) => string): MonthGroup<T>[] {
    const map = new Map<string, T[]>();
    for (const item of items) {
        const key = dateOf(item).slice(0, 7);
        map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].map(([key, list]) => {
        const [y, m] = key.split('-').map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'});
        return {key, label, items: list};
    });
}
