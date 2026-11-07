/**
 * Tax and social contribution rules for French micro-entrepreneurs (régime micro-social).
 * All amounts are in euro cents. Rates are stored as dated periods and each payment uses the
 * period in force on its date, so changing rates from a date never alters past amounts.
 * Reference: https://www.autoentrepreneur.urssaf.fr
 */
export type Activity = 'bnc' | 'bnc_cipav' | 'bic_services' | 'bic_vente';
export type DeclarationFrequency = 'monthly' | 'quarterly';

export interface Rates {
    /** Social contributions */
    social: number;
    /** Income tax withheld at source (versement libératoire) */
    vl: number;
}

/** Settings in force from a given date until the next period. */
export interface RatePeriod {
    /** Effective date (YYYY-MM-DD) */
    from: string;
    rates: Rates;
    versementLiberatoire: boolean;
    /** Marginal income tax rate (yearly), to estimate tax outside the VL scheme */
    incomeTaxRate: number;
    /** URSSAF declaration frequency (yearly) */
    declarationFrequency: DeclarationFrequency;
    /** CFE (business property tax) amount (yearly) */
    cfeAmount: number;
    /** Revenue ceiling of the micro regime (yearly) */
    caCeiling: number;
    /** VAT exemption threshold (yearly) */
    tvaThreshold: number;
}

export interface TaxSettings {
    activity: Activity;
    /** Business start date (YYYY-MM-DD) */
    activityStart: string;
    /** No CFE during the first year */
    cfeExemptFirstYear: boolean;
    /** Sorted by effective date; at least one */
    periods: RatePeriod[];
}

export const ACTIVITY_LABELS: Record<Activity, string> = {
    bnc: 'Profession libérale non réglementée (BNC, SSI)',
    bnc_cipav: 'Profession libérale réglementée (BNC, CIPAV)',
    bic_services: 'Prestations de services commerciales/artisanales (BIC)',
    bic_vente: 'Vente de marchandises (BIC)',
};

/** Flat expense allowance used to estimate taxable income. */
export const ABATTEMENT: Record<Activity, number> = {
    bnc: 0.34,
    bnc_cipav: 0.34,
    bic_services: 0.5,
    bic_vente: 0.71,
};

export function defaultRates(activity: Activity): Rates {
    switch (activity) {
        case 'bnc':
            return {social: 0.261, vl: 0.022};
        case 'bnc_cipav':
            return {social: 0.232, vl: 0.022};
        case 'bic_services':
            return {social: 0.212, vl: 0.017};
        case 'bic_vente':
            return {social: 0.123, vl: 0.01};
    }
}

export function defaultCeilings(activity: Activity): {caCeiling: number; tvaThreshold: number} {
    return activity === 'bic_vente'
        ? {caCeiling: 188_700_00, tvaThreshold: 85_000_00}
        : {caCeiling: 77_700_00, tvaThreshold: 37_500_00};
}

export function defaultPeriod(activity: Activity, from: string): RatePeriod {
    return {
        from,
        rates: defaultRates(activity),
        versementLiberatoire: false,
        incomeTaxRate: 0.11,
        declarationFrequency: 'quarterly',
        cfeAmount: 0,
        ...defaultCeilings(activity),
    };
}

export function defaultTaxSettings(today = new Date()): TaxSettings {
    const activityStart = `${today.getUTCFullYear()}-01-01`;
    return {
        activity: 'bnc',
        activityStart,
        cfeExemptFirstYear: true,
        periods: [defaultPeriod('bnc', activityStart)],
    };
}

/** Previous format (a single undated set of rates), still found in stored settings. */
interface LegacyTaxSettings extends Omit<RatePeriod, 'from'> {
    activity: Activity;
    activityStart: string;
    cfeExemptFirstYear: boolean;
}

/** Turns legacy settings into a first period covering the whole history. */
export function normalizeTaxSettings(raw: TaxSettings | LegacyTaxSettings): TaxSettings {
    const cleanRates = (r: Rates): Rates => ({social: r.social, vl: r.vl});
    if ('periods' in raw && Array.isArray(raw.periods)) {
        // Drop fields from older versions (ACRE, CFP, chamber fees)
        const periods = raw.periods.map((p) => ({
            from: p.from,
            rates: cleanRates(p.rates),
            versementLiberatoire: p.versementLiberatoire,
            incomeTaxRate: p.incomeTaxRate,
            declarationFrequency: p.declarationFrequency,
            cfeAmount: p.cfeAmount,
            caCeiling: p.caCeiling,
            tvaThreshold: p.tvaThreshold,
        }));
        return {
            activity: raw.activity,
            activityStart: raw.activityStart,
            cfeExemptFirstYear: raw.cfeExemptFirstYear,
            periods: sortPeriods(periods),
        };
    }
    const old = raw as LegacyTaxSettings;
    return {
        activity: old.activity,
        activityStart: old.activityStart,
        cfeExemptFirstYear: old.cfeExemptFirstYear,
        periods: [
            {
                from: old.activityStart,
                rates: cleanRates(old.rates),
                versementLiberatoire: old.versementLiberatoire,
                incomeTaxRate: old.incomeTaxRate,
                declarationFrequency: old.declarationFrequency,
                cfeAmount: old.cfeAmount,
                caCeiling: old.caCeiling,
                tvaThreshold: old.tvaThreshold,
            },
        ],
    };
}

export function sortPeriods(periods: RatePeriod[]): RatePeriod[] {
    return [...periods].sort((a, b) => a.from.localeCompare(b.from));
}

/** Period in force on a date; before the first effective date, the first period applies. */
export function periodAt(s: TaxSettings, date: string): RatePeriod {
    let current = s.periods[0];
    for (const p of s.periods) {
        if (p.from <= date) current = p;
        else break;
    }
    return current;
}

/** Yearly settings of a year are those in force on December 31. */
export function annualPeriod(s: TaxSettings, year: number): RatePeriod {
    return periodAt(s, `${year}-12-31`);
}
