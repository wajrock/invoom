import {Component, computed, effect, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {ReplaceUrlLinks} from '../../core/navigation/replace-url-links';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {errorMessage} from '../../core/http/error-message';
import {EurPipe} from '../../shared/pipes/eur.pipe';
import {PageHeader} from '../../shared/ui/page-header/page-header';
import {SegmentedControl, type SegmentOption} from '../../shared/ui/segmented-control/segmented-control';
import {centsToInput, formatCents, parseEuros} from '../../shared/utils/money';
import {TaxSettingsApi} from '../settings/tax-settings.api';
import type {ActivityDefaults} from '../settings/tax-settings.models';
import {CustomRatesFields, type CustomRatesForm, formFromInputs, parseCustomRates} from './custom-rates/custom-rates';
import {SimulatorApi} from './simulator.api';
import type {Simulation, SimulationFrom} from './simulator.models';

const DIRECTIONS: SegmentOption<SimulationFrom>[] = [
    {value: 'gross', label: 'Je facture…'},
    {value: 'net', label: 'Je veux toucher…'},
];

const QUICK_AMOUNTS = [500_00, 1_000_00, 2_500_00, 5_000_00];

const percent = new Intl.NumberFormat('fr-FR', {style: 'percent', maximumFractionDigits: 2});

@Component({
    selector: 'app-simulator',
    imports: [
        FormsModule,
        RouterLink,
        ReplaceUrlLinks,
        HlmButtonImports,
        HlmCardImports,
        HlmInputImports,
        HlmLabelImports,
        EurPipe,
        PageHeader,
        SegmentedControl,
        CustomRatesFields,
    ],
    templateUrl: './simulator.page.html',
})
export class SimulatorPage {
    private readonly api = inject(SimulatorApi);
    private readonly taxApi = inject(TaxSettingsApi);

    protected readonly from = signal<SimulationFrom>('gross');
    protected readonly input = signal(centsToInput(1_000_00));
    protected readonly result = signal<Simulation | null>(null);
    protected readonly error = signal('');
    protected readonly quickAmounts = QUICK_AMOUNTS;
    protected readonly directions = DIRECTIONS;

    /** Rates as typed, pre-filled from the saved tax settings by the first simulation */
    protected readonly ratesForm = signal<CustomRatesForm | null>(null);
    /** The pre-filled rates, to undo the edits */
    private readonly savedForm = signal<CustomRatesForm | null>(null);
    /** Yearly CFE of the saved settings; the rates sent afterwards carry none */
    private readonly savedCfe = signal(0);
    protected readonly activities = signal<ActivityDefaults[]>([]);
    /** Parsed rates; null while one of them is invalid. */
    protected readonly rates = computed(() => {
        const f = this.ratesForm();
        return f ? parseCustomRates(f) : null;
    });
    protected readonly ratesInvalid = computed(() => this.ratesForm() !== null && this.rates() === null);
    protected readonly edited = computed(() => JSON.stringify(this.ratesForm()) !== JSON.stringify(this.savedForm()));

    protected readonly amount = computed(() => parseEuros(this.input()));
    protected readonly invalid = computed(() => this.input().trim() !== '' && this.amount() === null);

    /** Share of each part in the amount invoiced, for the bar. */
    protected readonly shares = computed(() => {
        const r = this.result();
        if (!r || r.gross === 0) return null;
        const pct = (v: number) => `${(v / r.gross) * 100}%`;
        return {net: pct(r.net), social: pct(r.social), tax: pct(r.vl + r.incomeTax)};
    });

    protected readonly exclusions = computed(() => {
        const cfe = this.savedCfe();
        return cfe > 0 ? `Hors TVA et hors CFE (${formatCents(cfe, true)} par an).` : 'Hors TVA.';
    });

    private requestId = 0;

    constructor() {
        // Recompute shortly after typing stops; an older answer never replaces a newer one
        effect((onCleanup) => {
            const amount = this.amount();
            const from = this.from();
            // The first call uses the saved settings and pre-fills the form; the next ones send the form
            const custom = this.ratesForm() ? this.rates() : undefined;
            if (amount === null || custom === null) return;
            const id = ++this.requestId;
            const timer = setTimeout(async () => {
                try {
                    const r = await this.api.simulate(amount, from, custom);
                    if (id !== this.requestId) return;
                    if (!custom) this.prefill(r);
                    this.result.set(r);
                    this.error.set('');
                } catch (err) {
                    if (id === this.requestId) this.error.set(errorMessage(err));
                }
            }, 200);
            onCleanup(() => clearTimeout(timer));
        });

        void this.loadActivities();
    }

    private prefill(r: Simulation) {
        const form = formFromInputs(r.inputs, r.versementLiberatoire);
        this.savedForm.set(form);
        this.savedCfe.set(r.cfe);
        this.ratesForm.set(form);
    }

    private async loadActivities() {
        try {
            this.activities.set(await this.taxApi.defaults());
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    protected resetRates() {
        this.ratesForm.set(this.savedForm());
    }

    protected pick(cents: number) {
        this.input.set(centsToInput(cents));
    }

    protected percent(rate: number): string {
        return percent.format(rate);
    }
}
