import {centsToInput, parseEuros, parsePercent, percentToInput} from './money';

describe('money helpers', () => {
    it('parses French-formatted amounts to cents', () => {
        expect(parseEuros('1 234,56 €')).toBe(123456);
        expect(parseEuros('1 234,5')).toBe(123450);
        expect(parseEuros('0.1')).toBe(10);
    });

    it('rejects empty, negative or invalid amounts', () => {
        expect(parseEuros('')).toBeNull();
        expect(parseEuros('-5')).toBeNull();
        expect(parseEuros('abc')).toBeNull();
    });

    it('round-trips cents through an input field', () => {
        expect(centsToInput(123456)).toBe('1234,56');
        expect(parseEuros(centsToInput(99))).toBe(99);
    });

    it('parses percentages within 0–100', () => {
        expect(parsePercent('20,5 %', 1)).toBe(0.205);
        expect(parsePercent('101', 1)).toBeNull();
        expect(percentToInput(0.205, 1)).toBe('20,5');
    });
});
