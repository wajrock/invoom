import {Component, computed, input, model} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {parsePercent, percentToInput} from '../../../shared/utils/money';
import type {Activity, ActivityDefaults} from '../../settings/tax-settings.models';
import type {CustomRates, Simulation} from '../simulator.models';

const DECIMALS = 3;

/** Custom rates as typed: percentages are text. */
export interface CustomRatesForm {
    activity: Activity;
    social: string;
    vlOn: boolean;
    vl: string;
    incomeTaxRate: string;
}

export function formFromInputs(inputs: Simulation['inputs'], vlOn: boolean): CustomRatesForm {
    return {
        activity: inputs.activity,
        social: percentToInput(inputs.social, DECIMALS),
        vlOn,
        vl: percentToInput(inputs.vl, DECIMALS),
        incomeTaxRate: percentToInput(inputs.incomeTaxRate, DECIMALS),
    };
}

/** Null while a percentage is empty or outside 0–100. */
export function parseCustomRates(f: CustomRatesForm): CustomRates | null {
    const social = parsePercent(f.social, DECIMALS);
    const vl = parsePercent(f.vl, DECIMALS);
    const incomeTaxRate = parsePercent(f.incomeTaxRate, DECIMALS);
    if (social === null || vl === null || incomeTaxRate === null) return null;
    return {activity: f.activity, social, vlOn: f.vlOn, vl, incomeTaxRate};
}

/** Rates used by the simulator instead of the saved tax settings. */
@Component({
    selector: 'app-custom-rates',
    imports: [FormsModule, HlmInputImports, HlmLabelImports, HlmSwitchImports],
    templateUrl: './custom-rates.html',
})
export class CustomRatesFields {
    readonly value = model.required<CustomRatesForm>();
    readonly activities = input<ActivityDefaults[]>([]);

    /** Standard rate of the activity when the typed one is lower: only ACRE brings it down */
    protected readonly standardSocial = computed(() => {
        const f = this.value();
        const standard = this.activities().find((a) => a.activity === f.activity)?.rates.social;
        const typed = parsePercent(f.social, DECIMALS);
        return standard !== undefined && typed !== null && typed < standard ? percentToInput(standard, DECIMALS) : null;
    });

    protected set<K extends keyof CustomRatesForm>(key: K, v: CustomRatesForm[K]) {
        this.value.update((f) => ({...f, [key]: v}));
    }

    /** A new activity changes the allowance; start from its usual rates too. */
    protected setActivity(activity: Activity) {
        const d = this.activities().find((a) => a.activity === activity);
        this.value.update((f) => ({
            ...f,
            activity,
            ...(d && {social: percentToInput(d.rates.social, DECIMALS), vl: percentToInput(d.rates.vl, DECIMALS)}),
        }));
    }
}
