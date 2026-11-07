import {Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideArrowRight, lucideCheck, lucideClock, lucideTrendingDown, lucideTrendingUp} from '@ng-icons/lucide';
import {HlmBadgeImports} from '@spartan-ng/helm/badge';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {toast} from '@spartan-ng/brain/sonner';
import type {EChartsCoreOption} from 'echarts/core';
import {NgxEchartsDirective} from 'ngx-echarts';
import {Api, errorMessage} from '../core/api';
import {daysUntil, EurPipe, formatCents, FrDatePipe, relativeDays} from '../core/format';
import {type Dashboard, type Deadline, KIND_LABELS} from '../core/models';
import {ThemeService} from '../core/theme';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

@Component({
    selector: 'app-dashboard',
    imports: [
        RouterLink,
        NgIcon,
        NgxEchartsDirective,
        EurPipe,
        FrDatePipe,
        HlmBadgeImports,
        HlmButtonImports,
        HlmCardImports,
        HlmSkeletonImports,
    ],
    providers: [provideIcons({lucideTrendingUp, lucideTrendingDown, lucideArrowRight, lucideCheck, lucideClock})],
    template: `
        <div class="page-head">
            <div>
                <h1>Tableau de bord</h1>
                <p class="text-muted-foreground text-sm">Chiffre d'affaires encaissé et charges estimées</p>
            </div>
            <select
                class="select-native w-auto!"
                aria-label="Année"
                [value]="year()"
                (change)="setYear($any($event.target).value)"
            >
                @for (y of yearOptions(); track y) {
                    <option [value]="y" [selected]="y === year()">{{ y }}</option>
                }
            </select>
        </div>

        @if (data(); as d) {
            <!-- Indicateurs -->
            <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <section hlmCard class="gap-2 py-4">
                    <div hlmCardContent class="px-3.5 sm:px-4">
                        <p class="text-muted-foreground text-xs sm:text-sm">CA encaissé {{ d.year }}</p>
                        <p class="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                            {{ d.summary.ca | eur: true }}
                        </p>
                        @if (growth(); as g) {
                            <p
                                class="mt-1 flex items-center gap-1 text-xs"
                                [class]="g.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'"
                            >
                                <ng-icon [name]="g.value >= 0 ? 'lucideTrendingUp' : 'lucideTrendingDown'" />
                                {{ g.label }} vs {{ g.period }}
                            </p>
                        } @else {
                            <p class="text-muted-foreground mt-1 text-xs">
                                {{ d.previous.ca | eur: true }} en {{ d.year - 1 }}
                            </p>
                        }
                    </div>
                </section>
                <section hlmCard class="gap-2 py-4">
                    <div hlmCardContent class="px-3.5 sm:px-4">
                        <p class="text-muted-foreground text-xs sm:text-sm">URSSAF {{ d.year }}</p>
                        <p class="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                            {{ d.summary.social | eur: true }}
                        </p>
                        <p class="text-muted-foreground mt-1 text-xs">
                            Cotisations sociales · {{ rateOfCa(d.summary.social) }} du CA
                        </p>
                    </div>
                </section>
                <section hlmCard class="gap-2 py-4">
                    <div hlmCardContent class="px-3.5 sm:px-4">
                        <p class="text-muted-foreground text-xs sm:text-sm">Impôts {{ d.year }}</p>
                        <p class="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                            {{ taxes().total | eur: true }}
                        </p>
                        <dl class="mt-1.5 grid gap-0.5 text-xs">
                            @for (t of taxes().lines; track t.label) {
                                <div class="flex justify-between gap-2">
                                    <dt class="text-muted-foreground">{{ t.label }}</dt>
                                    <dd class="tabular-nums">{{ t.value }}</dd>
                                </div>
                            }
                        </dl>
                    </div>
                </section>
                <section hlmCard class="gap-2 py-4">
                    <div hlmCardContent class="px-3.5 sm:px-4">
                        <p class="text-muted-foreground text-xs sm:text-sm">Net estimé</p>
                        <p class="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                            {{ d.summary.net | eur: true }}
                        </p>
                        <p class="text-muted-foreground mt-1 text-xs">Après cotisations et impôts</p>
                    </div>
                </section>
            </div>

            <div class="mt-4 grid gap-4 lg:grid-cols-3">
                <!-- Graphique -->
                <section hlmCard class="lg:col-span-2">
                    <div hlmCardHeader>
                        <h2 hlmCardTitle>Encaissements mensuels</h2>
                        <p hlmCardDescription>{{ d.year }} comparé à {{ d.year - 1 }}</p>
                    </div>
                    <div hlmCardContent>
                        <div echarts [options]="chart()" class="h-56 w-full sm:h-72"></div>
                    </div>
                </section>

                <!-- Seuils -->
                <section hlmCard>
                    <div hlmCardHeader>
                        <h2 hlmCardTitle>Seuils {{ d.year }}</h2>
                        <p hlmCardDescription>Calculés sur le CA encaissé</p>
                    </div>
                    <div hlmCardContent class="grid gap-5">
                        @for (t of thresholds(); track t.label) {
                            <div>
                                <div class="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                                    <span class="font-medium">{{ t.label }}</span>
                                    <span class="text-muted-foreground tabular-nums">{{ t.pct }} %</span>
                                </div>
                                <div class="bg-muted h-2 overflow-hidden rounded-full">
                                    <div
                                        class="h-full rounded-full transition-all"
                                        [class]="t.color"
                                        [style.width.%]="t.bar"
                                    ></div>
                                </div>
                                <p class="text-muted-foreground mt-1.5 text-xs">
                                    {{ d.summary.ca | eur: true }} / {{ t.limit | eur: true }} · reste
                                    {{ t.remaining | eur: true }}
                                </p>
                            </div>
                        }
                        @if (d.pending.count > 0) {
                            <a
                                routerLink="/paiements"
                                class="bg-muted/60 hover:bg-muted flex items-center gap-3 rounded-lg p-3 text-sm transition-colors"
                            >
                                <ng-icon name="lucideClock" class="text-muted-foreground text-base" />
                                <span class="flex-1">
                                    <span class="font-medium"
                                        >{{ d.pending.count }} facture{{ d.pending.count > 1 ? 's' : '' }} en
                                        attente</span
                                    ><br />
                                    <span class="text-muted-foreground"
                                        >{{ d.pending.amount | eur }} non encaissé{{
                                            d.pending.count > 1 ? 's' : ''
                                        }}</span
                                    >
                                </span>
                                <ng-icon name="lucideArrowRight" />
                            </a>
                        }
                    </div>
                </section>
            </div>

            <div class="mt-4 grid gap-4 lg:grid-cols-3">
                <!-- Échéances -->
                <section hlmCard class="lg:col-span-2">
                    <div hlmCardHeader>
                        <h2 hlmCardTitle>Prochaines échéances</h2>
                        <p hlmCardDescription>Non réglées, en retard ou dans les 6 mois</p>
                    </div>
                    <div hlmCardContent>
                        @if (d.upcoming.length === 0) {
                            <p class="text-muted-foreground py-6 text-center text-sm">Rien à prévoir pour l’instant.</p>
                        } @else {
                            <ul class="divide-y">
                                @for (dl of d.upcoming; track dl.id) {
                                    <li class="flex items-center gap-3 py-2.5">
                                        <div class="min-w-0 flex-1">
                                            <p class="truncate text-sm font-medium">{{ dl.title }}</p>
                                            <p class="text-muted-foreground text-xs">
                                                {{ dl.dueOn | frDate }} ·
                                                <span
                                                    [class.text-destructive]="isLate(dl)"
                                                    [class.font-medium]="isLate(dl)"
                                                    >{{ rel(dl.dueOn) }}</span
                                                >
                                            </p>
                                        </div>
                                        <span hlmBadge variant="outline" class="max-sm:hidden">{{
                                            kindLabel(dl)
                                        }}</span>
                                        <span class="text-right text-sm tabular-nums sm:w-24">{{
                                            dl.amount | eur
                                        }}</span>
                                        <button
                                            hlmBtn
                                            variant="ghost"
                                            size="icon-sm"
                                            (click)="markDone(dl)"
                                            aria-label="Marquer comme réglée"
                                            title="Marquer comme réglée"
                                        >
                                            <ng-icon name="lucideCheck" />
                                        </button>
                                    </li>
                                }
                            </ul>
                        }
                        <a hlmBtn variant="link" routerLink="/echeances" class="mt-2 px-0"
                            >Toutes les échéances <ng-icon name="lucideArrowRight"
                        /></a>
                    </div>
                </section>

                <!-- Détail des charges -->
                <section hlmCard>
                    <div hlmCardHeader>
                        <h2 hlmCardTitle>Détail {{ d.year }}</h2>
                    </div>
                    <div hlmCardContent>
                        <dl class="grid gap-2 text-sm">
                            @for (row of breakdown(); track row.label) {
                                <div
                                    class="flex justify-between gap-2"
                                    [class]="row.strong ? 'border-t pt-2 font-semibold' : ''"
                                >
                                    <dt [class.text-muted-foreground]="!row.strong">{{ row.label }}</dt>
                                    <dd class="tabular-nums">{{ row.value }}</dd>
                                </div>
                            }
                        </dl>
                        @if (d.settings.periodsInYear > 1) {
                            <p class="text-muted-foreground mt-3 text-xs">
                                Les taux ont changé en cours d’année : chaque encaissement est calculé avec les taux en
                                vigueur à sa date.
                            </p>
                        }
                    </div>
                </section>
            </div>
        } @else if (error()) {
            <p class="text-destructive text-sm">{{ error() }}</p>
        } @else {
            <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                @for (i of [1, 2, 3, 4]; track i) {
                    <hlm-skeleton class="h-28 rounded-xl" />
                }
            </div>
            <hlm-skeleton class="mt-4 block h-80 rounded-xl" />
        }
    `,
})
export class DashboardPage {
    private readonly api = inject(Api);
    private readonly themeService = inject(ThemeService);

    protected readonly year = signal(new Date().getFullYear());
    protected readonly data = signal<Dashboard | null>(null);
    protected readonly error = signal('');

    protected readonly yearOptions = computed(() => {
        const current = new Date().getFullYear();
        const ys = new Set([current, this.year(), ...(this.data()?.years ?? [])]);
        return [...ys].sort((a, b) => b - a);
    });

    /** Évolution vs l'an dernier, à période égale pour l'année en cours */
    protected readonly growth = computed(() => {
        const d = this.data();
        if (!d) return null;
        const now = new Date();
        const partial = d.year === now.getFullYear();
        const months = partial ? now.getMonth() + 1 : 12;
        const sum = (arr: number[]) => arr.slice(0, months).reduce((s, v) => s + v, 0);
        const cur = sum(d.monthly);
        const prev = sum(d.previousMonthly);
        if (prev === 0) return null;
        const value = (cur - prev) / prev;
        const label = `${value >= 0 ? '+' : ''}${Math.round(value * 100)} %`;
        return {value, label, period: partial ? `${MONTHS[0]}–${MONTHS[months - 1]} ${d.year - 1}` : `${d.year - 1}`};
    });

    protected readonly thresholds = computed(() => {
        const d = this.data();
        if (!d) return [];
        return [
            {label: 'Franchise de TVA', limit: d.thresholds.tvaThreshold},
            {label: 'Plafond micro-entreprise', limit: d.thresholds.caCeiling},
        ].map((t) => {
            const ratio = t.limit > 0 ? d.summary.ca / t.limit : 0;
            return {
                ...t,
                pct: Math.round(ratio * 100),
                bar: Math.min(100, ratio * 100),
                remaining: Math.max(0, t.limit - d.summary.ca),
                color: ratio >= 1 ? 'bg-destructive' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-primary',
            };
        });
    });

    /** Impôts de l'année : impôt sur le revenu (estimé et/ou versement libératoire) + CFE */
    protected readonly taxes = computed(() => {
        const d = this.data();
        if (!d) return {total: 0, lines: [] as {label: string; value: string}[]};
        const s = d.summary;
        const lines: {label: string; value: string}[] = [];
        if (s.ca > s.caUnderVl || s.vl === 0)
            lines.push({label: 'Impôt sur le revenu (estimé)', value: formatCents(s.incomeTaxEstimate, true)});
        if (s.vl > 0) lines.push({label: 'Versement libératoire', value: formatCents(s.vl, true)});
        lines.push({label: 'CFE', value: s.cfeExempt ? 'exonérée' : formatCents(s.cfe, true)});
        return {total: s.incomeTaxEstimate + s.vl + s.cfe, lines};
    });

    protected readonly breakdown = computed(() => {
        const d = this.data();
        if (!d) return [];
        const s = d.summary;
        const rows: {label: string; value: string; strong?: boolean}[] = [
            {label: 'CA encaissé', value: formatCents(s.ca)},
            {label: 'Cotisations sociales (URSSAF)', value: '− ' + formatCents(s.social)},
        ];
        if (s.ca > s.caUnderVl || s.vl === 0)
            rows.push({label: 'Impôt sur le revenu (estimé)', value: '− ' + formatCents(s.incomeTaxEstimate)});
        if (s.vl > 0) rows.push({label: 'Versement libératoire', value: '− ' + formatCents(s.vl)});
        rows.push({label: s.cfeExempt ? 'CFE (exonérée)' : 'CFE', value: '− ' + formatCents(s.cfe)});
        rows.push({label: 'Net estimé', value: formatCents(s.net), strong: true});
        return rows;
    });

    protected readonly chart = computed<EChartsCoreOption>(() => {
        const d = this.data();
        const dark = this.themeService.theme() === 'dark';
        const text = dark ? '#a1a1aa' : '#71717a';
        const grid = dark ? 'rgba(255,255,255,0.08)' : '#e4e4e7';
        const toEur = (v: number) => Math.round(v) / 100;
        return {
            animationDuration: 400,
            grid: {left: 8, right: 8, top: 32, bottom: 8, containLabel: true},
            legend: {top: 0, right: 0, textStyle: {color: text}, itemWidth: 12, itemHeight: 8},
            tooltip: {
                trigger: 'axis',
                valueFormatter: (v: number) => formatCents(Math.round(v * 100)),
                backgroundColor: dark ? '#27272a' : '#fff',
                borderColor: grid,
                textStyle: {color: dark ? '#fafafa' : '#18181b'},
            },
            xAxis: {
                type: 'category',
                data: MONTHS,
                axisLine: {lineStyle: {color: grid}},
                axisTick: {show: false},
                axisLabel: {color: text},
            },
            yAxis: {
                type: 'value',
                splitLine: {lineStyle: {color: grid}},
                axisLabel: {
                    color: text,
                    formatter: (v: number) => (v >= 1000 ? `${Math.round(v / 1000)} k€` : `${v} €`),
                },
            },
            series: [
                {
                    name: String(d ? d.year : ''),
                    type: 'bar',
                    data: (d?.monthly ?? []).map(toEur),
                    itemStyle: {color: dark ? '#60a5fa' : '#2563eb', borderRadius: [4, 4, 0, 0]},
                    barMaxWidth: 28,
                },
                {
                    name: String(d ? d.year - 1 : ''),
                    type: 'line',
                    data: (d?.previousMonthly ?? []).map(toEur),
                    itemStyle: {color: dark ? '#71717a' : '#a1a1aa'},
                    lineStyle: {type: 'dashed', width: 2},
                    symbol: 'circle',
                    symbolSize: 5,
                },
            ],
        };
    });

    constructor() {
        void this.load();
    }

    setYear(v: string) {
        this.year.set(Number(v));
        void this.load();
    }

    async load() {
        this.error.set('');
        try {
            this.data.set(await this.api.dashboard(this.year()));
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    async markDone(dl: Deadline) {
        try {
            await this.api.setDeadlineDone(dl.id, true);
            toast.success('Échéance marquée comme réglée', {
                action: {label: 'Annuler', onClick: () => void this.undo(dl)},
            });
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }

    private async undo(dl: Deadline) {
        await this.api.setDeadlineDone(dl.id, false);
        await this.load();
    }

    rateOfCa(v: number) {
        const ca = this.data()?.summary.ca ?? 0;
        return ca > 0 ? `${((v / ca) * 100).toLocaleString('fr-FR', {maximumFractionDigits: 1})} %` : '0 %';
    }

    isLate(dl: Deadline) {
        return daysUntil(dl.dueOn) < 0;
    }
    rel(iso: string) {
        return relativeDays(iso);
    }
    kindLabel(dl: Deadline) {
        return KIND_LABELS[dl.kind];
    }
}
