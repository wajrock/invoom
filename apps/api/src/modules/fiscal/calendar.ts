/** ISO dates (YYYY-MM-DD) computed in UTC to avoid time zone shifts. */

export function pad(n: number) {
    return String(n).padStart(2, '0');
}

/** Last day of the month; month0 is 0-11 and may overflow into the next year. */
export function lastDayOfMonth(year: number, month0: number): string {
    const d = new Date(Date.UTC(year, month0 + 1, 0));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function firstDayOfMonth(year: number, month0: number): string {
    const d = new Date(Date.UTC(year, month0, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
}

/** Easter Sunday (Meeus/Butcher algorithm). */
function easterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** National public holidays in mainland France. */
export function frenchHolidays(year: number): Set<string> {
    const easter = easterSunday(year);
    const plus = (days: number) => iso(new Date(easter.getTime() + days * 864e5));
    return new Set([
        `${year}-01-01`,
        plus(1), // Easter Monday
        `${year}-05-01`,
        `${year}-05-08`,
        plus(39), // Ascension Day
        plus(50), // Whit Monday
        `${year}-07-14`,
        `${year}-08-15`,
        `${year}-11-01`,
        `${year}-11-11`,
        `${year}-12-25`,
    ]);
}

/** Moves a date to the next business day (not a weekend or public holiday). */
export function nextBusinessDay(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    for (;;) {
        const day = d.getUTCDay();
        if (day !== 0 && day !== 6 && !frenchHolidays(d.getUTCFullYear()).has(iso(d))) return iso(d);
        d.setUTCDate(d.getUTCDate() + 1);
    }
}
