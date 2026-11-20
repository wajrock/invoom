import assert from 'node:assert/strict';
import {test} from 'node:test';
import {vatMentions, withVatMention} from './vat-mention.ts';

test('VAT mentions cite the CGI until 2026 and the CIBS from 1 January 2027', () => {
    assert.match(vatMentions('2026-12-31').franchise.fr, /art\. 293 B du CGI/);
    assert.match(vatMentions('2027-01-01').franchise.fr, /art\. L\. 233-3 du CIBS/);
    assert.match(vatMentions('2027-01-01').outside.fr, /L\. 211-92 du CIBS/);
    for (const regime of ['franchise', 'reverse', 'outside'] as const) {
        assert.doesNotMatch(vatMentions('2027-03-01')[regime].fr, /CGI/);
        assert.doesNotMatch(vatMentions('2026-06-01')[regime].fr, /CIBS/);
    }
    // The reverse charge mention must keep the word the CGI requires, in both languages
    assert.match(vatMentions('2027-01-01').reverse.fr, /Autoliquidation/);
    assert.match(vatMentions('2027-01-01').reverse.en, /Autoliquidation/);
});

test('an old CGI mention is replaced by the CIBS one, and the other way round', () => {
    const before = 'Prestation de services.\nTVA non applicable, art. 293 B du CGI.\nPaiement par virement.';
    const after = withVatMention(before, vatMentions('2027-02-01').franchise.fr);
    assert.equal(after, 'Prestation de services.\nTVA non applicable, art. L. 233-3 du CIBS.\nPaiement par virement.');
    // Back-dated invoice: the CIBS line gives way to the CGI one, never both
    const back = withVatMention(after, vatMentions('2026-12-15').outside.fr);
    assert.equal(back.split('\n').filter((l) => /CGI|CIBS/.test(l)).length, 1);
    assert.match(back, /259-1 du CGI/);
});

test('Windows line ends do not leave a stray carriage return', () => {
    const terms = 'Prestation de services.\r\nTVA non applicable, art. 293 B du CGI.\r\nPaiement par virement.';
    const next = withVatMention(terms, vatMentions('2027-01-01').franchise.fr);
    assert.ok(!next.includes('\r'));
    assert.equal(next.split('\n')[1], 'TVA non applicable, art. L. 233-3 du CIBS.');
});
