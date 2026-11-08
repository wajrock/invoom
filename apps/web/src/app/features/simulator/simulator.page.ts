import {Component, computed, effect, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {errorMessage} from '../../core/http/error-message';
import {EurPipe} from '../../shared/pipes/eur.pipe';
import {PageHeader} from '../../shared/ui/page-header/page-header';
import {centsToInput, formatCents, parseEuros} from '../../shared/utils/money';
import {SimulatorApi} from './simulator.api';
import type {Simulation, SimulationFrom} from './simulator.models';

const QUICK_AMOUNTS = [500_00, 1_000_00, 2_500_00, 5_000_00];

const percent = new Intl.NumberFormat('fr-FR', {style: 'percent', maximumFractionDigits: 2});

@Component({
    selector: 'app-simulator',
    imports: [FormsModule, RouterLink, HlmCardImports, HlmInputImports, HlmLabelImports, EurPipe, PageHeader],
    templateUrl: './simulator.page.html',
})
export class SimulatorPage {
    private readonly api = inject(SimulatorApi);

    protected readonly from = signal<SimulationFrom>('gross');
    protected readonly input = signal(centsToInput(1_000_00));
    protected readonly result = signal<Simulation | null>(null);
    protected readonly error = signal('');
    protected readonly quickAmounts = QUICK_AMOUNTS;

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
        const cfe = this.result()?.cfe ?? 0;
        return cfe > 0 ? `Hors TVA et hors CFE (${formatCents(cfe, true)} par an).` : 'Hors TVA.';
    });

    private requestId = 0;

    constructor() {
        // Recompute shortly after typing stops; an older answer never replaces a newer one
        effect((onCleanup) => {
            const amount = this.amount();
            const from = this.from();
            if (amount === null) return;
            const id = ++this.requestId;
            const timer = setTimeout(async () => {
                try {
                    const r = await this.api.simulate(amount, from);
                    if (id !== this.requestId) return;
                    this.result.set(r);
                    this.error.set('');
                } catch (err) {
                    if (id === this.requestId) this.error.set(errorMessage(err));
                }
            }, 200);
            onCleanup(() => clearTimeout(timer));
        });
    }

    protected setFrom(from: SimulationFrom) {
        this.from.set(from);
    }

    protected pick(cents: number) {
        this.input.set(centsToInput(cents));
    }

    protected percent(rate: number): string {
        return percent.format(rate);
    }
}
