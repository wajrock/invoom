import {ABATTEMENT, annualPeriod, periodAt, type TaxSettings} from './tax-settings.ts';
import {isCfeExempt} from './charges.ts';

export interface Simulation {
    /** Amount invoiced and received (excluding VAT), in cents */
    gross: number;
    social: number;
    /** Income tax withheld with URSSAF contributions (versement libératoire) */
    vl: number;
    /** Estimated income tax when the VL scheme is off */
    incomeTax: number;
    /** What is left after contributions and income tax */
    net: number;
    rates: {social: number; vl: number; incomeTax: number};
    versementLiberatoire: boolean;
    /** Yearly CFE, not spread over a single amount */
    cfe: number;
}

/** Charges on `gross` with the rates in force on `date`, rounded like the dashboard. */
export function simulateFromGross(gross: number, s: TaxSettings, date: string): Simulation {
    const period = periodAt(s, date);
    const year = Number(date.slice(0, 4));
    const vlRate = period.versementLiberatoire ? period.rates.vl : 0;
    // Outside the VL scheme, income tax applies to revenue after the flat allowance
    const incomeTaxRate = period.versementLiberatoire ? 0 : (1 - ABATTEMENT[s.activity]) * period.incomeTaxRate;
    const social = Math.round(gross * period.rates.social);
    const vl = Math.round(gross * vlRate);
    const incomeTax = Math.round(gross * incomeTaxRate);
    return {
        gross,
        social,
        vl,
        incomeTax,
        net: gross - social - vl - incomeTax,
        rates: {social: period.rates.social, vl: vlRate, incomeTax: incomeTaxRate},
        versementLiberatoire: period.versementLiberatoire,
        cfe: isCfeExempt(year, s) ? 0 : annualPeriod(s, year).cfeAmount,
    };
}

/** Smallest amount to invoice so that at least `net` is left after charges. */
export function simulateFromNet(net: number, s: TaxSettings, date: string): Simulation {
    const {rates} = simulateFromGross(0, s, date);
    const keep = 1 - rates.social - rates.vl - rates.incomeTax;
    if (keep <= 0) throw new Error('Charges at or above 100 %');
    let gross = Math.ceil(net / keep);
    // Rounding each charge can be off by a cent either way
    while (simulateFromGross(gross, s, date).net < net) gross++;
    while (gross > 0 && simulateFromGross(gross - 1, s, date).net >= net) gross--;
    return simulateFromGross(gross, s, date);
}
