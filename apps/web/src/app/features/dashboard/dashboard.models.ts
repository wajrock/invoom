import type {Deadline} from '../deadlines/deadline.models';
import type {DeclarationFrequency} from '../settings/tax-settings.models';

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
