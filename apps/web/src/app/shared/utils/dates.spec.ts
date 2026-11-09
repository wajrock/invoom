import {formatPeriod} from './dates';

describe('formatPeriod', () => {
    it('is empty without dates', () => {
        expect(formatPeriod(null, '')).toBe('');
    });

    it('shortens a period within one month or one year', () => {
        expect(formatPeriod('2026-10-01', '2026-10-31')).toBe('1–31 oct. 2026');
        expect(formatPeriod('2026-10-15', '2026-11-14')).toBe('15 oct. – 14 nov. 2026');
    });

    it('keeps both years across a new year, and handles open periods', () => {
        expect(formatPeriod('2025-12-15', '2026-01-14')).toBe('15 déc. 2025 – 14 janv. 2026');
        expect(formatPeriod('2026-11-04', '')).toBe('dès le 4 nov. 2026');
    });
});
