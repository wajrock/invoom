import type {Client} from '../clients/client.schema.ts';

/**
 * Mandatory VAT mention of an invoice, from the client. Same rules as the web invoice form
 * (apps/web/src/app/features/clients/countries.ts): keep both in step.
 */
export type VatRegime = 'franchise' | 'reverse' | 'outside';

/** EU VAT number prefixes (EL = Greece, XI = Northern Ireland) */
const EU_VAT_PREFIXES = new Set(
    'AT BE BG CY CZ DE DK EE EL ES FI FR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK XI'.split(' '),
);

export function vatRegime(client: Pick<Client, 'countryCode' | 'vatNumber'>): VatRegime {
    const prefix = client.vatNumber.replace(/\s/g, '').slice(0, 2).toUpperCase();
    const euBusiness = EU_VAT_PREFIXES.has(prefix) && prefix !== 'FR';
    if (client.countryCode === 'FR') return 'franchise';
    if (client.countryCode === 'IT' || client.countryCode === 'DE') return euBusiness ? 'reverse' : 'franchise';
    return euBusiness ? 'reverse' : 'outside';
}

type Mentions = Record<VatRegime, {fr: string; en: string}>;

/** Business client in another EU country: the customer accounts for the VAT in its own country */
const REVERSE_CHARGE = {
    fr: 'Autoliquidation – TVA due par le preneur (art. 196 de la directive 2006/112/CE).',
    en: 'Reverse charge – VAT to be accounted for by the customer (Article 196 of Council Directive 2006/112/EC). Autoliquidation.',
};

/** Until 31 December 2026: VAT rules in the Code général des impôts */
const CGI_MENTIONS: Mentions = {
    franchise: {
        fr: 'TVA non applicable, art. 293 B du CGI.',
        en: 'VAT not applicable, article 293 B of the French General Tax Code (CGI).',
    },
    // Same wording before and after 2027: the CGI's art. 283-2 covers the opposite case (a foreign supplier billing
    // a French customer); what the law asks is the word "Autoliquidation", and the EU directive is the reference
    reverse: REVERSE_CHARGE,
    outside: {
        fr: 'TVA non applicable – art. 259-1 du CGI (prestation de services hors de France).',
        en: 'VAT not applicable – Article 259-1 of the French General Tax Code (services supplied outside France).',
    },
};

/**
 * From 1 January 2027 the VAT rules move to the Code des impositions sur les biens et services (ordonnances
 * n° 2025-1247 and n° 2026-671): franchise L. 233-3 (impots.gouv.fr), place of supply to a business L. 211-92. Citing
 * the CIBS before that date would be wrong.
 */
const CIBS_MENTIONS: Mentions = {
    franchise: {
        fr: 'TVA non applicable, art. L. 233-3 du CIBS.',
        en: 'VAT not applicable, article L. 233-3 of the French Tax Code on Goods and Services (CIBS).',
    },
    reverse: REVERSE_CHARGE,
    outside: {
        fr: 'TVA non applicable – art. L. 211-92 du CIBS (prestation de services hors de France).',
        en: 'VAT not applicable – Article L. 211-92 of the French Tax Code on Goods and Services (CIBS) (services supplied outside France).',
    },
};

export const CIBS_FROM = '2027-01-01';

/** Mentions in force on the invoice's issue date (YYYY-MM-DD) */
export function vatMentions(issuedOn: string): Mentions {
    return issuedOn >= CIBS_FROM ? CIBS_MENTIONS : CGI_MENTIONS;
}

/** Terms lines about VAT, whatever the variant or the code they cite */
const VAT_LINE = /293\s*B|L\.?\s*233-3|autoliquidation|reverse charge|259-1|L\.?\s*211-92|2006\/112/i;

/** Replaces the existing VAT mention with the expected one (or inserts it as the 2nd line). */
export function withVatMention(terms: string, mention: string): string {
    // Pasted text may carry Windows line ends: a stray \r would stay at the end of each line
    const lines = terms.replace(/\r\n?/g, '\n').split('\n');
    const first = lines.findIndex((l) => VAT_LINE.test(l));
    if (first === -1) {
        lines.splice(Math.min(1, lines.length), 0, mention);
        return lines.join('\n');
    }
    return lines
        .map((l, i) => (i === first ? mention : l))
        .filter((l, i) => i === first || !VAT_LINE.test(l))
        .join('\n');
}
