export type Activity = 'bnc' | 'bnc_cipav' | 'bic_services' | 'bic_vente';
export type DeclarationFrequency = 'monthly' | 'quarterly';

export interface Rates {
    social: number;
    vl: number;
}

/** Settings applying from a date until the next period */
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
