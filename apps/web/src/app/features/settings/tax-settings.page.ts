import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronDown, lucideHistory, lucidePlus} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmBadgeImports} from '@spartan-ng/helm/badge';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {errorMessage} from '../../core/http/error-message';
import {DateInput} from '../../shared/ui/date-input/date-input';
import {SettingsSection} from '../../shared/ui/settings-section/settings-section';
import {Spinner} from '../../shared/ui/spinner/spinner';
import {formatDate, todayIso} from '../../shared/utils/dates';
import {
    applyActivityDefaults,
    copyPeriod,
    parsePeriod,
    periodSummary,
    settingsToForm,
    type PeriodForm,
    type SettingsForm,
} from './period-form';
import {RatePeriodEditor} from './rate-period-editor/rate-period-editor';
import {TaxSettingsApi} from './tax-settings.api';
import type {ActivityDefaults, RatePeriod, TaxSettings} from './tax-settings.models';
import {type HasUnsavedChanges} from '../../core/navigation/unsaved-changes.guard';
import {Confirm} from '../../shared/ui/confirm/confirm';

@Component({
    selector: 'app-tax-settings',
    imports: [
        FormsModule,
        NgIcon,
        DateInput,
        HlmBadgeImports,
        HlmButtonImports,
        HlmLabelImports,
        HlmSkeletonImports,
        HlmSwitchImports,
        RatePeriodEditor,
        SettingsSection,
        Spinner,
    ],
    providers: [provideIcons({lucidePlus, lucideChevronDown, lucideHistory})],
    templateUrl: './tax-settings.page.html',
})
export class TaxSettingsPage implements HasUnsavedChanges {
    private readonly api = inject(TaxSettingsApi);
    private readonly confirm = inject(Confirm);

    protected readonly form = signal<SettingsForm | null>(null);
    protected readonly defaults = signal<ActivityDefaults[]>([]);
    protected readonly saving = signal(false);
    protected readonly error = signal('');
    protected readonly openKey = signal<number | null>(null);
    /** Bumped to re-sort after a period is added or removed (periods are mutated in place) */
    private readonly version = signal(0);
    private saved: TaxSettings | null = null;
    /** Form as loaded or last saved, to tell whether it holds changes */
    private pristine = '';

    /** Most recent first */
    protected readonly sortedPeriods = computed(() => {
        this.version();
        return [...(this.form()?.periods ?? [])].sort((a, b) => b.from.localeCompare(a.from));
    });

    /** Period applying today */
    protected readonly currentKey = computed(() => {
        const today = todayIso();
        const asc = [...this.sortedPeriods()].reverse();
        return (asc.filter((p) => p.from <= today).at(-1) ?? asc[0])?.key ?? null;
    });

    protected readonly periodSummary = periodSummary;

    constructor() {
        void this.load();
    }

    async load() {
        try {
            const [settings, defaults] = await Promise.all([this.api.get(), this.api.defaults()]);
            this.defaults.set(defaults);
            this.setSaved(settings);
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    private setSaved(settings: TaxSettings) {
        this.saved = settings;
        const form = settingsToForm(settings);
        this.form.set(form);
        this.pristine = JSON.stringify(form);
        this.openKey.set(null);
    }

    canLeave() {
        return !this.hasUnsavedChanges() || this.confirm.discardChanges();
    }

    private hasUnsavedChanges() {
        const f = this.form();
        return !!f && JSON.stringify(f) !== this.pristine;
    }

    async reset() {
        if (!this.saved || !this.hasUnsavedChanges()) return;
        const ok = await this.confirm.ask({
            title: 'Annuler les modifications ?',
            description: 'Les paramètres reviennent à leur dernier enregistrement.',
            confirmLabel: 'Annuler les modifications',
            cancelLabel: 'Continuer',
            destructive: true,
        });
        if (ok) this.setSaved(this.saved);
    }

    toggleOpen(p: PeriodForm) {
        this.openKey.set(this.openKey() === p.key ? null : p.key);
    }

    isFuture(p: PeriodForm) {
        return p.from > todayIso();
    }

    periodTitle(p: PeriodForm, isOldest: boolean) {
        return isOldest ? 'Depuis le début d’activité' : `À partir du ${formatDate(p.from)}`;
    }

    addPeriod() {
        const f = this.form();
        if (!f) return;
        const today = todayIso();
        const p = copyPeriod(this.sortedPeriods()[0], f.periods.some((x) => x.from === today) ? '' : today);
        f.periods.push(p);
        this.version.update((v) => v + 1);
        this.openKey.set(p.key);
    }

    async removePeriod(p: PeriodForm) {
        const f = this.form();
        if (!f || f.periods.length <= 1) return;
        if (
            !(await this.confirm.ask({
                title: `Supprimer la période du ${formatDate(p.from)} ?`,
                description:
                    'Les encaissements concernés seront recalculés avec la période précédente, une fois enregistré.',
                confirmLabel: 'Supprimer',
                destructive: true,
            }))
        )
            return;
        f.periods = f.periods.filter((x) => x !== p);
        this.version.update((v) => v + 1);
    }

    applyDefaults(p: PeriodForm) {
        const d = this.defaults().find((x) => x.activity === this.form()?.activity);
        if (d) applyActivityDefaults(p, d);
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

        // The oldest period covers the whole history: align it on the activity start
        periods.sort((a, b) => a.from.localeCompare(b.from));
        if (periods[0].from > f.activityStart && !periods.some((p) => p.from === f.activityStart)) {
            periods[0] = {...periods[0], from: f.activityStart};
        }

        const body: TaxSettings = {
            activity: f.activity,
            activityStart: f.activityStart,
            cfeExemptFirstYear: f.cfeExemptFirstYear,
            autoDeadlines: f.autoDeadlines,
            periods,
        };
        this.saving.set(true);
        try {
            this.setSaved(await this.api.save(body));
            toast.success('Paramètres enregistrés');
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
