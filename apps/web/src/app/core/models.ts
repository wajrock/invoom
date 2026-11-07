/** Types partagés avec l'API (tous les montants sont en centimes d'euro). */
import type {CountryCode} from './countries';

export type Activity = 'bnc' | 'bnc_cipav' | 'bic_services' | 'bic_vente';
export type DeadlineKind = 'urssaf' | 'cfe' | 'impot' | 'autre';
export type FileLang = 'fr' | 'en' | 'other';

export interface CompanyField {
    id: string;
    group: string;
    label: string;
    value: string;
}
export interface Company {
    fields: CompanyField[];
}

export interface PlatformInput {
    name: string;
    url: string;
    category: string;
    description: string;
    login: string;
}
export interface Platform extends PlatformInput {
    id: string;
    position: number;
}

export interface InvoiceFile {
    id: string;
    lang: FileLang;
    name: string;
    mime: string;
    size: number;
    /** PDF produit par le générateur (remplacé à chaque régénération) */
    generated?: boolean;
}

export interface ClientExtra {
    label: string;
    value: string;
}
export interface ClientInput {
    name: string;
    /** Pays : détermine les champs demandés (SIREN, Code SdI, USt-IdNr…) */
    countryCode: CountryCode;
    address: string;
    /** Pays sur la facture FR */
    country: string;
    /** Pays sur la facture EN (à défaut : celui de la facture FR) */
    countryEn: string;
    /** SIREN / SIRET ou n° d'immatriculation étranger */
    registration: string;
    vatNumber: string;
    email: string;
    /** Champs libres imprimés sur la facture (Code SdI, PEC…) */
    extra: ClientExtra[];
    /** Générer la facture anglaise par défaut */
    english: boolean;
    currency: string;
    notes: string;
}
export interface Client extends ClientInput {
    id: string;
}

export interface InvoiceLine {
    label: string;
    labelEn: string;
    detail: string;
    detailEn: string;
    unit: string;
    unitEn: string;
    quantity: number;
    /** Prix unitaire HT en centimes */
    unitPrice: number;
}
/** Prestation du catalogue : ligne de facture réutilisable (sans quantité) */
export type ServiceInput = Omit<InvoiceLine, 'quantity'> & {
    /** Client auquel la prestation est réservée (null = tous les clients) */
    clientId: string | null;
};
export interface Service extends ServiceInput {
    id: string;
}

export interface InvoiceInput {
    clientId: string;
    number: string;
    issuedOn: string;
    dueOn: string;
    periodFrom: string | null;
    periodTo: string | null;
    currency: string;
    vatRate: number;
    lines: InvoiceLine[];
    english: boolean;
    termsFr: string;
    termsEn: string;
}
/** Facture enregistrée avec son paiement (coordonnées client figées à l'émission) */
export interface StoredInvoice extends InvoiceInput {
    client: ClientInput;
    generatedAt: string;
}
export interface GenerateInvoice {
    paymentId: string | null;
    invoice: InvoiceInput;
    /** Montant en euros (centimes) si la facture est dans une autre devise */
    eurAmount: number | null;
}
export interface InvoiceSettings {
    paymentDays: number;
    termsFr: string;
    termsEn: string;
}

export interface PaymentInput {
    clientId: string | null;
    client: string;
    label: string;
    invoiceNumber: string;
    issuedOn: string;
    paidOn: string | null;
    amount: number;
    originalAmount: number | null;
    originalCurrency: string;
    notes: string;
}
export interface Payment extends PaymentInput {
    id: string;
    files: InvoiceFile[];
    invoice: StoredInvoice | null;
}

export interface DeadlineInput {
    title: string;
    dueOn: string;
    kind: DeadlineKind;
    amount: number | null;
    note: string;
}
export interface Deadline extends DeadlineInput {
    id: string;
    auto: boolean;
    done: boolean;
    doneAt: string | null;
}

export interface Rates {
    social: number;
    vl: number;
}
export type DeclarationFrequency = 'monthly' | 'quarterly';

/** Paramètres applicables à partir d'une date, jusqu'à la période suivante */
export interface RatePeriod {
    from: string;
    rates: Rates;
    versementLiberatoire: boolean;
    incomeTaxRate: number;
    declarationFrequency: DeclarationFrequency;
    cfeAmount: number;
    caCeiling: number;
    tvaThreshold: number;
}
export interface TaxSettings {
    activity: Activity;
    activityStart: string;
    cfeExemptFirstYear: boolean;
    periods: RatePeriod[];
}
export interface ActivityDefaults {
    activity: Activity;
    label: string;
    rates: Rates;
    caCeiling: number;
    tvaThreshold: number;
}

export interface YearSummary {
    year: number;
    ca: number;
    social: number;
    vl: number;
    urssaf: number;
    caUnderVl: number;
    incomeTaxEstimate: number;
    cfe: number;
    cfeExempt: boolean;
    net: number;
}

export interface Dashboard {
    year: number;
    years: number[];
    monthly: number[];
    previousMonthly: number[];
    summary: YearSummary;
    previous: YearSummary;
    thresholds: {caCeiling: number; tvaThreshold: number};
    settings: {declarationFrequency: DeclarationFrequency; periodsInYear: number};
    upcoming: Deadline[];
    today: string;
    pending: {count: number; amount: number};
}

export const KIND_LABELS: Record<DeadlineKind, string> = {
    urssaf: 'URSSAF',
    cfe: 'CFE',
    impot: 'Impôt',
    autre: 'Autre',
};

export const LANG_LABELS: Record<FileLang, string> = {
    fr: 'FR',
    en: 'EN',
    other: 'Autre',
};
