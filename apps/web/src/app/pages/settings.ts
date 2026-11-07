import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {
    lucideChevronDown,
    lucideHistory,
    lucideLoader2,
    lucidePlus,
    lucideRotateCcw,
    lucideTrash2,
} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmBadgeImports} from '@spartan-ng/helm/badge';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {Api, errorMessage} from '../core/api';
import {DateInput} from '../shared/date-input';
import {centsToInput, formatCents, formatDate, parseEuros, todayIso} from '../core/format';
import type {Activity, ActivityDefaults, DeclarationFrequency, RatePeriod, TaxSettings} from '../core/models';

/** Saisie d'une période : taux en pourcentage et montants en euros, sous forme de texte */
interface PeriodForm {
    /** Identifiant local pour le suivi dans la liste */
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

interface SettingsForm {
    activity: Activity;
    activityStart: string;
    cfeExemptFirstYear: boolean;
    periods: PeriodForm[];
}

let nextKey = 1;

const pct = (rate: number) => String(Math.round(rate * 100_000) / 1000).replace('.', ',');

function parsePct(v: string): number | null {
    const s = v.replace(/[\s%]/g, '').replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 1000) / 100_000 : null;
}

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

function toForm(s: TaxSettings): SettingsForm {
    return {
        activity: s.activity,
        activityStart: s.activityStart,
        cfeExemptFirstYear: s.cfeExemptFirstYear,
        periods: s.periods.map(periodToForm),
    };
}

function parsePeriod(f: PeriodForm): RatePeriod | string {
    const label = `Période du ${formatDate(f.from)}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.from)) return 'Date d’effet manquante';
    const rates = {social: parsePct(f.social), vl: parsePct(f.vl)};
    const incomeTaxRate = parsePct(f.incomeTaxRate);
    if (Object.values(rates).some((v) => v === null) || incomeTaxRate === null) {
        return `${label} : un des taux est invalide (entre 0 et 100 %)`;
    }
    const caCeiling = parseEuros(f.caCeiling);
    const tvaThreshold = parseEuros(f.tvaThreshold);
    if (caCeiling === null || tvaThreshold === null) return `${label} : seuils invalides`;
    return {
        from: f.from,
        rates: rates as RatePeriod['rates'],
        versementLiberatoire: f.versementLiberatoire,
        incomeTaxRate,
        declarationFrequency: f.declarationFrequency,
        cfeAmount: parseEuros(f.cfeAmount) ?? 0,
        caCeiling,
        tvaThreshold,
    };
}

@Component({
    selector: 'app-settings',
    imports: [
        FormsModule,
        NgIcon,
        DateInput,
        HlmBadgeImports,
        HlmButtonImports,
        HlmCardImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSkeletonImports,
        HlmSwitchImports,
    ],
    providers: [
        provideIcons({lucideLoader2, lucideRotateCcw, lucidePlus, lucideTrash2, lucideChevronDown, lucideHistory}),
    ],
    template: `
        <div class="page-head block!">
            <h1>Paramètres fiscaux</h1>
            <p class="text-muted-foreground mt-1 text-sm max-md:block!">
                Utilisés pour estimer les cotisations et générer les échéances. Vérifie les taux chaque année sur
                <a
                    class="underline underline-offset-2"
                    href="https://www.autoentrepreneur.urssaf.fr"
                    target="_blank"
                    rel="noopener"
                    >autoentrepreneur.urssaf.fr</a
                >.
            </p>
        </div>

        @if (form(); as f) {
            <form class="grid gap-6" (ngSubmit)="save()">
                <!-- Paramètres permanents -->
                <section hlmCard>
                    <div hlmCardHeader>
                        <h2 hlmCardTitle>Activité</h2>
                    </div>
                    <div hlmCardContent class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <label hlmLabel for="s-activity">Type d’activité</label>
                            <select class="select-native" id="s-activity" name="activity" [(ngModel)]="f.activity">
                                @for (d of defaults(); track d.activity) {
                                    <option [value]="d.activity">{{ d.label }}</option>
                                }
                            </select>
                        </div>
                        <div class="grid gap-2">
                            <label hlmLabel for="s-start">Début d’activité</label>
                            <app-date-input
                                inputId="s-start"
                                name="activityStart"
                                required
                                [(ngModel)]="f.activityStart"
                            />
                        </div>
                        <div class="flex items-start gap-3">
                            <hlm-switch
                                inputId="s-cfe-ex"
                                [checked]="f.cfeExemptFirstYear"
                                (checkedChange)="f.cfeExemptFirstYear = $event"
                            />
                            <label hlmLabel for="s-cfe-ex">CFE exonérée l’année de création</label>
                        </div>
                    </div>
                </section>

                <!-- Périodes de taux -->
                <section hlmCard>
                    <div hlmCardHeader>
                        <h2 hlmCardTitle class="flex items-center gap-2">
                            <ng-icon name="lucideHistory" /> Historique des taux
                        </h2>
                        <p hlmCardDescription>
                            Chaque encaissement est calculé avec la période en vigueur à sa date d’encaissement : un
                            nouveau taux ne modifie jamais les montants passés. Les paramètres annuels (impôt, CFE,
                            seuils, fréquence) sont ceux en vigueur au 31 décembre.
                        </p>
                        <div hlmCardAction>
                            <button hlmBtn type="button" size="sm" (click)="addPeriod()">
                                <ng-icon name="lucidePlus" /> Changement de taux
                            </button>
                        </div>
                    </div>
                    <div hlmCardContent class="grid gap-3">
                        @for (p of sortedPeriods(); track p.key; let last = $last) {
                            <div class="rounded-lg border">
                                <button
                                    type="button"
                                    class="hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg p-3 text-left"
                                    (click)="openKey.set(openKey() === p.key ? null : p.key)"
                                    [attr.aria-expanded]="openKey() === p.key"
                                >
                                    <div class="min-w-0 flex-1">
                                        <p class="flex flex-wrap items-center gap-2 font-medium">
                                            {{ periodTitle(p, last) }}
                                            @if (p.key === currentKey()) {
                                                <span hlmBadge variant="secondary">En vigueur</span>
                                            } @else if (isFuture(p)) {
                                                <span hlmBadge variant="outline">À venir</span>
                                            }
                                        </p>
                                        <p class="text-muted-foreground mt-0.5 text-xs">{{ periodSummary(p) }}</p>
                                    </div>
                                    <ng-icon
                                        name="lucideChevronDown"
                                        class="text-muted-foreground shrink-0 transition-transform"
                                        [class.rotate-180]="openKey() === p.key"
                                    />
                                </button>

                                @if (openKey() === p.key) {
                                    <div class="grid gap-4 border-t p-3">
                                        <div class="flex flex-wrap items-end gap-3">
                                            <div class="grid gap-2" [class.hidden]="last">
                                                <label hlmLabel [for]="'from-' + p.key">À partir du</label>
                                                <app-date-input
                                                    [inputId]="'from-' + p.key"
                                                    class="w-44"
                                                    required
                                                    [ngModelOptions]="{standalone: true}"
                                                    [(ngModel)]="p.from"
                                                />
                                            </div>
                                            <div class="ml-auto flex gap-2">
                                                <button
                                                    hlmBtn
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    (click)="applyDefaults(p)"
                                                >
                                                    <ng-icon name="lucideRotateCcw" /> Taux par défaut
                                                </button>
                                                @if (f.periods.length > 1) {
                                                    <button
                                                        hlmBtn
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        (click)="removePeriod(p)"
                                                    >
                                                        <ng-icon name="lucideTrash2" /> Supprimer
                                                    </button>
                                                }
                                            </div>
                                        </div>

                                        <div>
                                            <p
                                                class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase"
                                            >
                                                Taux sur le CA encaissé
                                            </p>
                                            <div class="grid gap-3 sm:grid-cols-2">
                                                <div class="grid gap-1.5">
                                                    <label hlmLabel [for]="'social-' + p.key"
                                                        >Taux de cotisations URSSAF (%)</label
                                                    >
                                                    <input
                                                        hlmInput
                                                        [id]="'social-' + p.key"
                                                        inputmode="decimal"
                                                        [ngModelOptions]="{standalone: true}"
                                                        [(ngModel)]="p.social"
                                                    />
                                                    <p class="text-muted-foreground text-xs">
                                                        Appliqué tel quel au CA encaissé. Indique le taux réellement
                                                        prélevé (celui de ton espace URSSAF, ACRE incluse).
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <p
                                                class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase"
                                            >
                                                Impôt sur le revenu
                                            </p>
                                            <div class="grid gap-3 sm:grid-cols-2 sm:items-end">
                                                <div class="flex items-center gap-3">
                                                    <hlm-switch
                                                        [inputId]="'vl-on-' + p.key"
                                                        [checked]="p.versementLiberatoire"
                                                        (checkedChange)="p.versementLiberatoire = $event"
                                                    />
                                                    <label hlmLabel [for]="'vl-on-' + p.key"
                                                        >Versement libératoire</label
                                                    >
                                                </div>
                                                @if (p.versementLiberatoire) {
                                                    <div class="grid gap-1.5">
                                                        <label hlmLabel [for]="'vl-' + p.key"
                                                            >Taux du versement libératoire (%)</label
                                                        >
                                                        <input
                                                            hlmInput
                                                            [id]="'vl-' + p.key"
                                                            inputmode="decimal"
                                                            [ngModelOptions]="{standalone: true}"
                                                            [(ngModel)]="p.vl"
                                                        />
                                                    </div>
                                                } @else {
                                                    <div class="grid gap-1.5">
                                                        <label hlmLabel [for]="'tmi-' + p.key"
                                                            >Taux marginal d’imposition (%)</label
                                                        >
                                                        <input
                                                            hlmInput
                                                            [id]="'tmi-' + p.key"
                                                            inputmode="decimal"
                                                            [ngModelOptions]="{standalone: true}"
                                                            [(ngModel)]="p.incomeTaxRate"
                                                        />
                                                    </div>
                                                }
                                            </div>
                                        </div>

                                        <div>
                                            <p
                                                class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase"
                                            >
                                                Paramètres annuels
                                            </p>
                                            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                <div class="grid gap-1.5">
                                                    <label hlmLabel [for]="'freq-' + p.key">Déclaration URSSAF</label>
                                                    <select
                                                        class="select-native"
                                                        [id]="'freq-' + p.key"
                                                        [ngModelOptions]="{standalone: true}"
                                                        [(ngModel)]="p.declarationFrequency"
                                                    >
                                                        <option value="quarterly">Trimestrielle</option>
                                                        <option value="monthly">Mensuelle</option>
                                                    </select>
                                                </div>
                                                <div class="grid gap-1.5">
                                                    <label hlmLabel [for]="'cfe-' + p.key">CFE annuelle (€)</label>
                                                    <input
                                                        hlmInput
                                                        [id]="'cfe-' + p.key"
                                                        inputmode="decimal"
                                                        [ngModelOptions]="{standalone: true}"
                                                        [(ngModel)]="p.cfeAmount"
                                                    />
                                                </div>
                                                <div class="grid gap-1.5">
                                                    <label hlmLabel [for]="'ceil-' + p.key">Plafond micro (€)</label>
                                                    <input
                                                        hlmInput
                                                        [id]="'ceil-' + p.key"
                                                        inputmode="decimal"
                                                        [ngModelOptions]="{standalone: true}"
                                                        [(ngModel)]="p.caCeiling"
                                                    />
                                                </div>
                                                <div class="grid gap-1.5">
                                                    <label hlmLabel [for]="'tva-' + p.key">Franchise de TVA (€)</label>
                                                    <input
                                                        hlmInput
                                                        [id]="'tva-' + p.key"
                                                        inputmode="decimal"
                                                        [ngModelOptions]="{standalone: true}"
                                                        [(ngModel)]="p.tvaThreshold"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        @if (!last) {
                                            <p class="text-muted-foreground text-xs">
                                                ⚠️ Modifier cette période recalcule les encaissements qu’elle couvre.
                                                Pour un changement de taux, ajoute plutôt une nouvelle période.
                                            </p>
                                        }
                                    </div>
                                }
                            </div>
                        }
                    </div>
                </section>

                <div
                    class="bg-background/85 sticky bottom-(--tabbar-h) z-20 -mx-4 flex justify-end gap-2 border-t px-4 py-3 backdrop-blur-xl max-sm:*:flex-1 md:mx-0 md:rounded-xl md:border"
                >
                    <button hlmBtn type="button" variant="outline" (click)="reset()">Annuler les modifications</button>
                    <button hlmBtn type="submit" [disabled]="saving()">
                        @if (saving()) {
                            <ng-icon name="lucideLoader2" class="animate-spin" />
                        }
                        Enregistrer
                    </button>
                </div>
            </form>
        } @else if (error()) {
            <p class="text-destructive text-sm">{{ error() }}</p>
        } @else {
            <hlm-skeleton class="block h-96 rounded-xl" />
        }
    `,
})
export class SettingsPage {
    private readonly api = inject(Api);

    protected readonly form = signal<SettingsForm | null>(null);
    protected readonly defaults = signal<ActivityDefaults[]>([]);
    protected readonly saving = signal(false);
    protected readonly error = signal('');
    protected readonly openKey = signal<number | null>(null);
    /** Incrémenté pour recalculer le tri après ajout / suppression */
    private readonly version = signal(0);
    private saved: TaxSettings | null = null;

    /** Plus récente en premier */
    protected readonly sortedPeriods = computed(() => {
        this.version();
        return [...(this.form()?.periods ?? [])].sort((a, b) => b.from.localeCompare(a.from));
    });

    /** Période applicable aujourd'hui */
    protected readonly currentKey = computed(() => {
        const today = todayIso();
        const asc = [...this.sortedPeriods()].reverse();
        return (asc.filter((p) => p.from <= today).at(-1) ?? asc[0])?.key ?? null;
    });

    constructor() {
        void this.load();
    }

    async load() {
        try {
            const [settings, defaults] = await Promise.all([this.api.taxSettings(), this.api.taxDefaults()]);
            this.saved = settings;
            this.defaults.set(defaults);
            this.form.set(toForm(settings));
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    reset() {
        if (this.saved) this.form.set(toForm(this.saved));
        this.openKey.set(null);
    }

    isFuture(p: PeriodForm) {
        return p.from > todayIso();
    }

    periodTitle(p: PeriodForm, isOldest: boolean) {
        const date = formatDate(p.from);
        return isOldest ? 'Depuis le début d’activité' : `À partir du ${date}`;
    }

    periodSummary(p: PeriodForm) {
        const parts = [
            `Cotisations ${p.social} %`,
            p.versementLiberatoire ? `VL ${p.vl} %` : `TMI ${p.incomeTaxRate} %`,
            p.declarationFrequency === 'monthly' ? 'mensuelle' : 'trimestrielle',
        ];
        const cfe = parseEuros(p.cfeAmount);
        if (cfe) parts.push(`CFE ${formatCents(cfe, true)}`);
        return parts.join(' · ');
    }

    addPeriod() {
        const f = this.form();
        if (!f) return;
        const latest = this.sortedPeriods()[0];
        const today = todayIso();
        const from = f.periods.some((p) => p.from === today) ? '' : today;
        const p: PeriodForm = {...latest, key: nextKey++, from};
        f.periods.push(p);
        this.version.update((v) => v + 1);
        this.openKey.set(p.key);
    }

    removePeriod(p: PeriodForm) {
        const f = this.form();
        if (!f || f.periods.length <= 1) return;
        if (
            !confirm(
                `Supprimer la période du ${formatDate(p.from)} ? Les encaissements concernés seront recalculés avec la période précédente.`,
            )
        )
            return;
        f.periods = f.periods.filter((x) => x !== p);
        this.version.update((v) => v + 1);
    }

    applyDefaults(p: PeriodForm) {
        const d = this.defaults().find((x) => x.activity === this.form()?.activity);
        if (!d) return;
        Object.assign(p, {
            social: pct(d.rates.social),
            vl: pct(d.rates.vl),
            caCeiling: centsToInput(d.caCeiling),
            tvaThreshold: centsToInput(d.tvaThreshold),
        });
    }

    async save() {
        const f = this.form();
        if (!f) return;
        const periods: RatePeriod[] = [];
        for (const pf of f.periods) {
            const res = parsePeriod(pf);
            if (typeof res === 'string') return void toast.error(res);
            periods.push(res);
        }
        if (new Set(periods.map((p) => p.from)).size !== periods.length) {
            return void toast.error('Deux périodes ont la même date d’effet');
        }

        // La période la plus ancienne couvre tout l'historique : on l'aligne sur le début d'activité
        periods.sort((a, b) => a.from.localeCompare(b.from));
        if (periods[0].from > f.activityStart && !periods.some((p) => p.from === f.activityStart)) {
            periods[0] = {...periods[0], from: f.activityStart};
        }

        const body: TaxSettings = {
            activity: f.activity,
            activityStart: f.activityStart,
            cfeExemptFirstYear: f.cfeExemptFirstYear,
            periods,
        };
        this.saving.set(true);
        try {
            this.saved = await this.api.saveTaxSettings(body);
            this.form.set(toForm(this.saved));
            this.openKey.set(null);
            toast.success('Paramètres enregistrés');
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
