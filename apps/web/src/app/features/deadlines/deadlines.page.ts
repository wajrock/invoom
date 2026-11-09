import {NgTemplateOutlet} from '@angular/common';
import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCalendarClock, lucideCalendarPlus, lucideHistory, lucidePlus} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {errorMessage} from '../../core/http/error-message';
import {EurPipe} from '../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../shared/pipes/fr-date.pipe';
import {EmptyState} from '../../shared/ui/empty-state/empty-state';
import {FilterBar} from '../../shared/ui/filter-bar/filter-bar';
import {KpiTile} from '../../shared/ui/kpi-tile/kpi-tile';
import {PageHeader} from '../../shared/ui/page-header/page-header';
import {daysUntil, groupByMonth, inMonths, relativeDays, todayIso} from '../../shared/utils/dates';
import {openDeadlineDetail} from './deadline-detail/deadline-detail';
import {openDeadlineDialog} from './deadline-dialog/deadline-dialog';
import {KIND_OPTIONS, type Deadline, type DeadlineKind} from './deadline.models';
import {DeadlineRow} from './deadline-row/deadline-row';
import {DeadlinesApi} from './deadlines.api';

type Tab = 'upcoming' | 'past';

const byDueDate = (d: Deadline) => d.dueOn;
const PAGE = 5;

@Component({
    selector: 'app-deadlines',
    imports: [
        FormsModule,
        NgTemplateOutlet,
        NgIcon,
        EurPipe,
        FrDatePipe,
        HlmButtonImports,
        HlmSkeletonImports,
        DeadlineRow,
        EmptyState,
        FilterBar,
        KpiTile,
        PageHeader,
    ],
    providers: [provideIcons({lucidePlus, lucideCalendarPlus, lucideCalendarClock, lucideHistory})],
    templateUrl: './deadlines.page.html',
})
export class DeadlinesPage {
    private readonly api = inject(DeadlinesApi);
    private readonly dialog = inject(HlmDialogService);

    protected readonly tabs: {value: Tab; label: string; icon: string}[] = [
        {value: 'upcoming', label: 'À venir', icon: 'lucideCalendarClock'},
        {value: 'past', label: 'Historique', icon: 'lucideHistory'},
    ];
    protected readonly kinds = KIND_OPTIONS;

    protected readonly tab = signal<Tab>('upcoming');
    protected readonly deadlines = signal<Deadline[] | null>(null);
    protected readonly error = signal('');
    protected readonly loading = signal(false);
    /** Months shown in the "À venir" tab */
    private readonly months = signal(12);
    protected readonly horizon = computed(() => inMonths(this.months()));

    // History tab filters
    protected readonly query = signal('');
    protected readonly year = signal('all');
    protected readonly kind = signal<'all' | DeadlineKind>('all');

    private readonly today = todayIso();

    protected readonly overdue = computed(() =>
        (this.deadlines() ?? []).filter((d) => !d.done && d.dueOn < this.today),
    );

    /** Upcoming deadlines are shown a few at a time: a year of monthly URSSAF lines is too long a list */
    private readonly shown = signal(PAGE);
    private readonly upcoming = computed(() =>
        (this.deadlines() ?? []).filter((d) => !d.done && d.dueOn >= this.today && d.dueOn <= this.horizon()),
    );
    protected readonly upcomingGroups = computed(() => groupByMonth(this.upcoming().slice(0, this.shown()), byDueDate));
    protected readonly hasMore = computed(() => this.upcoming().length > this.shown());

    /** First deadline still to settle, from today */
    protected readonly next = computed(() => (this.deadlines() ?? []).find((d) => !d.done && d.dueOn >= this.today));
    protected readonly nextWhen = computed(() => {
        const n = this.next();
        return n ? relativeDays(n.dueOn).replace(/^./, (c) => c.toUpperCase()) : '';
    });

    /** Unsettled deadlines, overdue included, falling within three months */
    private readonly soon = computed(() => {
        const limit = inMonths(3);
        return (this.deadlines() ?? []).filter((d) => !d.done && d.dueOn <= limit);
    });
    protected readonly dueSoon = computed(() => this.soon().reduce((sum, d) => sum + (d.amount ?? 0), 0));
    protected readonly dueSoonCount = computed(() => this.soon().length);

    /** Tab badge: overdue + due within 30 days */
    protected readonly upcomingCount = computed(
        () =>
            this.overdue().length +
            (this.deadlines() ?? []).filter((d) => !d.done && d.dueOn >= this.today && daysUntil(d.dueOn) <= 30).length,
    );

    /** History: past deadlines, plus future ones already settled */
    private readonly past = computed(() =>
        (this.deadlines() ?? []).filter((d) => d.done || d.dueOn < this.today).reverse(),
    );

    protected readonly pastYears = computed(() => [...new Set(this.past().map((d) => d.dueOn.slice(0, 4)))]);

    protected readonly hasFilters = computed(
        () => !!this.query().trim() || this.year() !== 'all' || this.kind() !== 'all',
    );

    protected readonly pastFiltered = computed(() => {
        const q = this.query().trim().toLowerCase();
        return this.past().filter((d) => {
            if (this.year() !== 'all' && !d.dueOn.startsWith(`${this.year()}-`)) return false;
            if (this.kind() !== 'all' && d.kind !== this.kind()) return false;
            if (q && !`${d.title} ${d.note}`.toLowerCase().includes(q)) return false;
            return true;
        });
    });

    protected readonly pastGroups = computed(() => groupByMonth(this.pastFiltered(), byDueDate));
    protected readonly pastTotal = computed(() => this.pastFiltered().reduce((s, d) => s + (d.amount ?? 0), 0));

    constructor() {
        void this.load();
    }

    async load() {
        this.error.set('');
        this.loading.set(true);
        try {
            // From the creation year (server default) up to the chosen horizon
            this.deadlines.set(await this.api.list({to: this.horizon()}));
        } catch (err) {
            this.error.set(errorMessage(err));
        } finally {
            this.loading.set(false);
        }
    }

    /** Next deadlines; loads another year once the loaded ones are all shown */
    showMore() {
        this.shown.update((n) => n + PAGE);
        if (this.shown() >= this.upcoming().length) {
            this.months.update((m) => m + 12);
            void this.load();
        }
    }

    async toggle(d: Deadline) {
        // Optimistic update
        this.deadlines.update(
            (list) =>
                list?.map((x) =>
                    x.id === d.id ? {...x, done: !d.done, doneAt: d.done ? null : new Date().toISOString()} : x,
                ) ?? null,
        );
        try {
            await this.api.setDone(d.id, !d.done);
        } catch (err) {
            toast.error(errorMessage(err));
            await this.load();
        }
    }

    /** Deadline card; generated ones can only be settled */
    detail(d: Deadline) {
        openDeadlineDetail(this.dialog, {deadline: d}).subscribe((action) => {
            if (action === 'toggle') void this.toggle(d);
            else if (action === 'edit') this.open(d);
            else if (action === 'delete') void this.remove(d);
        });
    }

    open(deadline?: Deadline) {
        openDeadlineDialog(this.dialog, {deadline}).subscribe((changed) => {
            if (changed) void this.load();
        });
    }

    async remove(d: Deadline) {
        if (!confirm(`Supprimer « ${d.title} » ?`)) return;
        try {
            await this.api.delete(d.id);
            toast.success('Échéance supprimée');
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }
}
