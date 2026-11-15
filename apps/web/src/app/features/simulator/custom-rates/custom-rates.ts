import {Component, computed, input, linkedSignal, model} from '@angular/core';
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
    /** Rates of the saved tax settings, offered first: "Mes taux" tells them from the activity's standard ones */
    readonly saved = input<CustomRatesForm | null>(null);

    /**
     * Entry shown in the list: the last one picked, kept while fields are edited. Whenever the form holds exactly
     * the saved rates again (e.g. after "Réinitialiser"), it is "Mes taux".
     */
    protected readonly choice = linkedSignal<CustomRatesForm, 'saved' | Activity>({
        source: this.value,
        computation: (form, previous) =>
            JSON.stringify(form) === JSON.stringify(this.saved()) ? 'saved' : (previous?.value ?? form.activity),
    });

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

    protected choose(choice: 'saved' | Activity) {
        const saved = this.saved();
        if (choice === 'saved' && saved) this.value.set(saved);
        else if (choice !== 'saved') this.setActivity(choice);
        this.choice.set(choice);
    }

    protected standardRate(a: ActivityDefaults) {
        return percentToInput(a.rates.social, DECIMALS);
    }

    /** A new activity changes the allowance; start from its usual rates too. */
    private setActivity(activity: Activity) {
        const d = this.activities().find((a) => a.activity === activity);
        this.value.update((f) => ({
            ...f,
            activity,
            ...(d && {social: percentToInput(d.rates.social, DECIMALS), vl: percentToInput(d.rates.vl, DECIMALS)}),
        }));
    }
}
