import type {Activity} from '../settings/tax-settings.models';

/** `gross`: from the amount invoiced to the net; `net`: from a target net to the amount to invoice. */
export type SimulationFrom = 'gross' | 'net';

/** Amounts in cents, rates as fractions (0.261 = 26.1 %). */
export interface Simulation {
    gross: number;
    social: number;
    vl: number;
    incomeTax: number;
    net: number;
    rates: {social: number; vl: number; incomeTax: number};
    versementLiberatoire: boolean;
    /** Yearly CFE, not included in the net */
    cfe: number;
    /** Settings the simulation used */
    inputs: {activity: Activity; social: number; vl: number; incomeTaxRate: number};
}

/** Rates typed in the simulator instead of the saved tax settings (fractions). */
export interface CustomRates {
    activity: Activity;
    social: number;
    vlOn: boolean;
    vl: number;
    incomeTaxRate: number;
}
