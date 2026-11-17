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

export const VAT_MENTIONS: Record<VatRegime, {fr: string; en: string}> = {
    franchise: {
        fr: 'TVA non applicable, art. 293 B du CGI.',
        en: 'VAT not applicable, article 293 B of the French General Tax Code (CGI).',
    },
    reverse: {
        fr: 'Autoliquidation – TVA due par le preneur (art. 283-2 du CGI ; art. 196 de la directive 2006/112/CE).',
        en: 'Reverse charge – VAT to be accounted for by the customer (Article 196 of Council Directive 2006/112/EC). Autoliquidation – art. 283-2 du CGI.',
    },
    outside: {
        fr: 'TVA non applicable – art. 259-1 du CGI (prestation de services hors de France).',
        en: 'VAT not applicable – Article 259-1 of the French General Tax Code (services supplied outside France).',
    },
};

/** Terms lines about VAT, whatever the variant */
const VAT_LINE = /293\s*B|autoliquidation|reverse charge|259-1|2006\/112/i;

/** Replaces the existing VAT mention with the expected one (or inserts it as the 2nd line). */
export function withVatMention(terms: string, mention: string): string {
    const lines = terms.split('\n');
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
