import {initials} from './avatar';

describe('initials', () => {
    it('takes the first letter of the first two words', () => {
        expect(initials('Spitzli Development')).toBe('SD');
        expect(initials('  jean   dupont  sarl ')).toBe('JD');
    });

    it('takes two letters of a single word, and falls back to "?"', () => {
        expect(initials('edisplay')).toBe('ED');
        expect(initials('')).toBe('?');
    });
});
