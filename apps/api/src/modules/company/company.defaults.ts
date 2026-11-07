import type {Company} from './company.schema.ts';

const f = (id: string, group: string, label: string) => ({id, group, label, value: ''});

export const DEFAULT_COMPANY: Company = {
    fields: [
        f('name', 'Identité', 'Nom / dénomination'),
        f('legal', 'Identité', 'Forme juridique'),
        f('siret', 'Identité', 'SIRET'),
        f('siren', 'Identité', 'SIREN'),
        f('ape', 'Identité', 'Code APE / NAF'),
        f('vat', 'Identité', 'N° TVA intracommunautaire'),
        f('vat-mention', 'Identité', 'Mention TVA'),
        f('address', 'Coordonnées', 'Adresse'),
        f('email', 'Coordonnées', 'E-mail'),
        f('phone', 'Coordonnées', 'Téléphone'),
        f('website', 'Coordonnées', 'Site web'),
        f('account-holder', 'Banque', 'Titulaire du compte'),
        f('iban', 'Banque', 'IBAN'),
        f('bic', 'Banque', 'BIC / SWIFT'),
        f('bank', 'Banque', 'Banque'),
    ],
};
DEFAULT_COMPANY.fields.find((x) => x.id === 'vat-mention')!.value = 'TVA non applicable, art. 293 B du CGI';

/** Fields added after release, inserted into existing records before the given field. */
export const ADDED_FIELDS: {id: string; before: string}[] = [{id: 'account-holder', before: 'iban'}];
