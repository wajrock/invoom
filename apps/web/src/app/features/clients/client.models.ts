import {countryProfile, type CountryCode} from './countries';

export interface ClientExtra {
    label: string;
    value: string;
}

export interface ClientInput {
    name: string;
    /** Drives the requested fields (SIREN, Code SdI, USt-IdNr…) */
    countryCode: CountryCode;
    address: string;
    /** Country printed on the French invoice */
    country: string;
    /** Country printed on the English invoice (defaults to the French one) */
    countryEn: string;
    /** SIREN / SIRET or foreign registration number */
    registration: string;
    vatNumber: string;
    email: string;
    /** Free fields printed on the invoice (Code SdI, PEC…) */
    extra: ClientExtra[];
    /** Also generate the English invoice by default */
    english: boolean;
    currency: string;
    notes: string;
}

export interface Client extends ClientInput {
    id: string;
}

export function emptyClient(countryCode: CountryCode = 'FR'): ClientInput {
    const p = countryProfile(countryCode);
    return {
        name: '',
        countryCode,
        address: '',
        country: p.nameFr,
        countryEn: p.nameEn,
        registration: '',
        vatNumber: '',
        email: '',
        extra: [],
        english: p.english,
        currency: 'EUR',
        notes: '',
    };
}
