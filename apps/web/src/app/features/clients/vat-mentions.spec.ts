import {describe, expect, it} from 'vitest';
import {vatMentions, vatRegimeLabel, withVatMention} from './countries';

describe('VAT mentions by issue date', () => {
    it('cites the CGI until 31 December 2026, the CIBS from 1 January 2027', () => {
        expect(vatMentions('2026-12-31').franchise.fr).toBe('TVA non applicable, art. 293 B du CGI.');
        expect(vatMentions('2027-01-01').franchise.fr).toBe('TVA non applicable, art. L. 233-3 du CIBS.');
        expect(vatMentions('2027-01-01').outside.fr).toContain('L. 211-92 du CIBS');
        expect(vatMentions('2027-01-01').reverse.fr).not.toContain('CGI');
        expect(vatRegimeLabel('franchise', '2027-05-02')).toContain('L. 233-3');
    });

    it('swaps the mention in custom terms when the date crosses the change', () => {
        const terms = 'Prestation de services.\nTVA non applicable, art. 293 B du CGI.\nPaiement par virement.';
        const next = withVatMention(terms, vatMentions('2027-01-10').franchise.fr);
        expect(next.split('\n')).toEqual([
            'Prestation de services.',
            'TVA non applicable, art. L. 233-3 du CIBS.',
            'Paiement par virement.',
        ]);
        expect(withVatMention(next, vatMentions('2026-12-20').franchise.fr)).toBe(terms);
    });
});
