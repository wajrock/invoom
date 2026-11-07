/** Profils pays : champs demandés et formats attendus dans la fiche client. */

export type CountryCode = 'FR' | 'IT' | 'DE' | 'OTHER';

export interface CountryField {
    /** Libellé imprimé sur la facture (stocké dans les mentions du client) */
    label: string;
    placeholder: string;
    hint?: string;
    /** Format attendu, après suppression des espaces */
    pattern?: RegExp;
    error?: string;
    /** Champ attendu pour ce pays : averti s'il est vide (sans bloquer) */
    expected?: boolean;
    uppercase?: boolean;
}

export interface CountryProfile {
    code: CountryCode;
    label: string;
    /** Nom du pays sur les factures FR / EN (vide = saisie libre) */
    nameFr: string;
    nameEn: string;
    /** Le client relève du SIREN (entreprise française) */
    siren: boolean;
    vat: CountryField;
    fields: CountryField[];
    /** Version anglaise générée par défaut */
    english: boolean;
}

export const COUNTRIES: CountryProfile[] = [
    {
        code: 'FR',
        label: 'France',
        nameFr: 'France',
        nameEn: 'France',
        siren: true,
        vat: {
            label: 'N° TVA intracommunautaire',
            placeholder: 'FR12345678901',
            pattern: /^FR[0-9A-Z]{2}\d{9}$/,
            error: 'Format attendu : FR + 2 caractères + SIREN (9 chiffres)',
            uppercase: true,
        },
        fields: [],
        english: false,
    },
    {
        code: 'IT',
        label: 'Italie',
        nameFr: 'Italie',
        nameEn: 'Italy',
        siren: false,
        vat: {
            label: 'Partita IVA (n° TVA)',
            placeholder: 'IT01234567890',
            pattern: /^IT\d{11}$/,
            error: 'Format attendu : IT + 11 chiffres',
            expected: true,
            uppercase: true,
        },
        fields: [
            {
                label: 'Code SdI',
                placeholder: 'USAL8PV',
                hint: 'Code destinataire à 7 caractères fourni par le client (0000000 s’il n’utilise que la PEC)',
                pattern: /^[A-Z0-9]{7}$/,
                error: 'Le Code SdI fait 7 lettres ou chiffres',
                expected: true,
                uppercase: true,
            },
            {
                label: 'PEC',
                placeholder: 'societa@pec.it',
                hint: 'Adresse e-mail certifiée, souvent demandée avec le Code SdI',
                pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
                error: 'Adresse PEC invalide',
            },
        ],
        english: true,
    },
    {
        code: 'DE',
        label: 'Allemagne',
        nameFr: 'Allemagne',
        nameEn: 'Germany',
        siren: false,
        vat: {
            label: 'USt-IdNr. (n° TVA)',
            placeholder: 'DE123456789',
            pattern: /^DE\d{9}$/,
            error: 'Format attendu : DE + 9 chiffres',
            expected: true,
            uppercase: true,
        },
        fields: [
            {
                label: 'Handelsregister',
                placeholder: 'HRB 12345, Amtsgericht München',
                hint: 'Optionnel : n° au registre du commerce, si le client le demande',
            },
        ],
        english: true,
    },
    {
        code: 'OTHER',
        label: 'Autre pays',
        nameFr: '',
        nameEn: '',
        siren: false,
        vat: {label: 'N° TVA / identifiant fiscal', placeholder: 'Optionnel'},
        fields: [],
        english: true,
    },
];

export const countryProfile = (code: CountryCode | undefined): CountryProfile =>
    COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1];

/** Valeur nettoyée pour comparaison au format (espaces retirés, majuscules si besoin) */
export function normalizeField(f: CountryField, value: string): string {
    const v = value.trim();
    return f.uppercase ? v.replace(/[\s.]/g, '').toUpperCase() : v;
}

/** Message d'erreur de format, ou '' si vide / valide */
export function fieldError(f: CountryField, value: string): string {
    const v = normalizeField(f, value);
    if (!v || !f.pattern) return '';
    return f.pattern.test(v) ? '' : (f.error ?? 'Format invalide');
}

/** SIREN (9 chiffres) ou SIRET (14 chiffres) */
export const SIREN_FIELD: CountryField = {
    label: 'SIREN',
    placeholder: '123 456 789',
    hint: 'SIREN (9 chiffres) ou SIRET (14 chiffres) du client',
    pattern: /^(\d{9}|\d{14})$/,
    error: 'Le SIREN fait 9 chiffres (14 pour un SIRET)',
    expected: true,
    uppercase: true,
};

// ── Mention TVA selon le client ─────────────────────────────────────────────

/** Préfixes des n° de TVA intracommunautaires (EL = Grèce, XI = Irlande du Nord) */
const EU_VAT_PREFIXES = new Set(
    'AT BE BG CY CZ DE DK EE EL ES FI FR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK XI'.split(' '),
);

/**
 * - franchise : client français, ou particulier de l'UE → franchise en base (art. 293 B)
 * - reverse : entreprise d'un autre pays de l'UE (n° de TVA) → autoliquidation par le client
 * - outside : client hors UE → prestation non soumise à la TVA française (art. 259-1)
 */
export type VatRegime = 'franchise' | 'reverse' | 'outside';

export function vatRegime(client: {countryCode?: CountryCode; vatNumber: string}): VatRegime {
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

/** Lignes de mentions qui portent sur la TVA, quelle que soit la variante */
const VAT_LINE = /293\s*B|autoliquidation|reverse charge|259-1|2006\/112/i;

/** Remplace la mention TVA existante (ou l'insère en 2ᵉ ligne) par celle attendue. */
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
