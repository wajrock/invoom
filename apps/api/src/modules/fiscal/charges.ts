import {ABATTEMENT, annualPeriod, periodAt, type TaxSettings} from './tax-settings.ts';

export interface Encaissement {
    /** Amount received, in euro cents */
    amount: number;
    /** YYYY-MM-DD */
    paidOn: string;
}

export interface Charges {
    ca: number;
    social: number;
    vl: number;
    /** Total due to URSSAF (contributions + VL) */
    urssaf: number;
    /** Revenue received under the VL scheme */
    caUnderVl: number;
}

/** Each payment uses the rates in force on the day it was received. */
export function computeCharges(items: Encaissement[], s: TaxSettings): Charges {
    let ca = 0;
    let caUnderVl = 0;
    let social = 0;
    let vl = 0;
    for (const p of items) {
        const period = periodAt(s, p.paidOn);
        ca += p.amount;
        // The user-entered rate already includes ACRE when applicable
        social += p.amount * period.rates.social;
        if (period.versementLiberatoire) {
            caUnderVl += p.amount;
            vl += p.amount * period.rates.vl;
        }
    }
    const r = Math.round;
    const res = {ca, caUnderVl, social: r(social), vl: r(vl)};
    return {...res, urssaf: res.social + res.vl};
}

export interface YearSummary extends Charges {
    year: number;
    /** Income tax on revenue outside VL: revenue after allowance × marginal rate */
    incomeTaxEstimate: number;
    cfe: number;
    cfeExempt: boolean;
    /** What is left after URSSAF (VL included), income tax and CFE */
    net: number;
}

export function isCfeExempt(year: number, s: TaxSettings): boolean {
    const startYear = Number(s.activityStart.slice(0, 4));
    return year < startYear || (s.cfeExemptFirstYear && year === startYear);
}

export function computeYear(year: number, items: Encaissement[], s: TaxSettings): YearSummary {
    const inYear = items.filter((p) => p.paidOn.startsWith(`${year}-`));
    const charges = computeCharges(inYear, s);
    const annual = annualPeriod(s, year);
    const incomeTaxEstimate = Math.round(
        (charges.ca - charges.caUnderVl) * (1 - ABATTEMENT[s.activity]) * annual.incomeTaxRate,
    );
    const cfeExempt = isCfeExempt(year, s);
    const cfe = cfeExempt ? 0 : annual.cfeAmount;
    return {
        ...charges,
        year,
        incomeTaxEstimate,
        cfe,
        cfeExempt,
        net: charges.ca - charges.urssaf - incomeTaxEstimate - cfe,
    };
}
