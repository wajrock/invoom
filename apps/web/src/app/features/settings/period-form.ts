import {formatDate} from '../../shared/utils/dates';
import {centsToInput, formatCents, parseEuros, parsePercent, percentToInput} from '../../shared/utils/money';
import type {Activity, ActivityDefaults, DeclarationFrequency, RatePeriod, TaxSettings} from './tax-settings.models';

/** Editable rate period: percentages and euro amounts as text */
export interface PeriodForm {
    /** Local id used to track the period in lists */
    key: number;
    from: string;
    versementLiberatoire: boolean;
    declarationFrequency: DeclarationFrequency;
    social: string;
    vl: string;
    incomeTaxRate: string;
    cfeAmount: string;
    caCeiling: string;
    tvaThreshold: string;
}

export interface SettingsForm {
    activity: Activity;
    activityStart: string;
    cfeExemptFirstYear: boolean;
    periods: PeriodForm[];
}

/** Percentages keep 3 decimals */
const RATE_DECIMALS = 3;
const pct = (rate: number) => percentToInput(rate, RATE_DECIMALS);
const parsePct = (v: string) => parsePercent(v, RATE_DECIMALS);

let nextKey = 1;

function periodToForm(p: RatePeriod): PeriodForm {
    return {
        key: nextKey++,
        from: p.from,
        versementLiberatoire: p.versementLiberatoire,
        declarationFrequency: p.declarationFrequency,
        social: pct(p.rates.social),
        vl: pct(p.rates.vl),
        incomeTaxRate: pct(p.incomeTaxRate),
        cfeAmount: centsToInput(p.cfeAmount),
        caCeiling: centsToInput(p.caCeiling),
        tvaThreshold: centsToInput(p.tvaThreshold),
    };
}

/** Copy of a period under a new key (new rate change) */
export function copyPeriod(p: PeriodForm, from: string): PeriodForm {
    return {...p, key: nextKey++, from};
}

export function settingsToForm(s: TaxSettings): SettingsForm {
    return {
        activity: s.activity,
        activityStart: s.activityStart,
        cfeExemptFirstYear: s.cfeExemptFirstYear,
        periods: s.periods.map(periodToForm),
    };
}

/** Parsed period, or an error message */
export function parsePeriod(f: PeriodForm): RatePeriod | string {
    const label = `Période du ${formatDate(f.from)}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.from)) return 'Date d’effet manquante';
    const social = parsePct(f.social);
    const vl = parsePct(f.vl);
    const incomeTaxRate = parsePct(f.incomeTaxRate);
    if (social === null || vl === null || incomeTaxRate === null) {
        return `${label} : un des taux est invalide (entre 0 et 100 %)`;
    }
    const caCeiling = parseEuros(f.caCeiling);
    const tvaThreshold = parseEuros(f.tvaThreshold);
    if (caCeiling === null || tvaThreshold === null) return `${label} : seuils invalides`;
    return {
        from: f.from,
        rates: {social, vl},
        versementLiberatoire: f.versementLiberatoire,
        incomeTaxRate,
        declarationFrequency: f.declarationFrequency,
        cfeAmount: parseEuros(f.cfeAmount) ?? 0,
        caCeiling,
        tvaThreshold,
    };
}

/** Resets the rates and thresholds of a period to the activity defaults. */
export function applyActivityDefaults(p: PeriodForm, d: ActivityDefaults) {
    Object.assign(p, {
        social: pct(d.rates.social),
        vl: pct(d.rates.vl),
        caCeiling: centsToInput(d.caCeiling),
        tvaThreshold: centsToInput(d.tvaThreshold),
    });
}

export function periodSummary(p: PeriodForm): string {
    const parts = [
        `Cotisations ${p.social} %`,
        p.versementLiberatoire ? `VL ${p.vl} %` : `TMI ${p.incomeTaxRate} %`,
        p.declarationFrequency === 'monthly' ? 'mensuelle' : 'trimestrielle',
    ];
    const cfe = parseEuros(p.cfeAmount);
    if (cfe) parts.push(`CFE ${formatCents(cfe, true)}`);
    return parts.join(' · ');
}
