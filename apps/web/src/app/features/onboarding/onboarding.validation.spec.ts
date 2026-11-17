import {describe, expect, it} from 'vitest';
import {addressError, bicError, emailError, formatSiret, ibanError, siretError} from './onboarding.validation';

describe('siretError', () => {
    it('accepts a valid SIRET, with or without spaces', () => {
        expect(siretError('73282932000074')).toBe('');
        expect(siretError('732 829 320 00074')).toBe('');
    });
    it('asks for it, then for a valid one', () => {
        expect(siretError('')).toBe('Indique ton SIRET.');
        for (const wrong of ['7328293200007A', '732829320', '7328293200007', '73282932000075']) {
            expect(siretError(wrong)).toBe('Saisis un SIRET valide.');
        }
    });
    it('follows the La Poste exception', () => {
        expect(siretError('35600000000001')).toBe('');
    });
});

describe('other fields', () => {
    it('formats a SIRET as printed on invoices', () => {
        expect(formatSiret('73282932000074')).toBe('732 829 320 00074');
        expect(formatSiret('123')).toBe('123');
    });
    it('checks the email, the address and the bank details', () => {
        expect(emailError('nom@domaine.fr')).toBe('');
        expect(emailError('nom@domaine')).toContain('pas valide');
        expect(addressError('1 rue X')).toContain('code postal');
        expect(addressError('1 rue X\n75001 Paris')).toBe('');
        expect(ibanError('')).toBe('');
        expect(ibanError('FR76 3000 6000 0112 3456 7890 189')).toBe('');
        expect(ibanError('FR76 3000 6000 0112 3456 7890 188')).toContain('pas valide');
        expect(bicError('AGRIFRPP')).toBe('');
        expect(bicError('AGRI')).toContain('8 ou 11');
    });
});
