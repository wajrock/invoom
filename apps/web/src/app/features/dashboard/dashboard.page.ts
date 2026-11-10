import {Component, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ReplaceUrlLinks} from '../../core/navigation/replace-url-links';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideArrowRight, lucideCheck, lucideClock, lucideTrendingDown, lucideTrendingUp} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmBadgeImports} from '@spartan-ng/helm/badge';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {NgxEchartsDirective} from 'ngx-echarts';
import {errorMessage} from '../../core/http/error-message';
import {EurPipe} from '../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../shared/pipes/fr-date.pipe';
import {KpiTile} from '../../shared/ui/kpi-tile/kpi-tile';
import {PageHeader} from '../../shared/ui/page-header/page-header';
import {daysUntil, relativeDays} from '../../shared/utils/dates';
import {KIND_LABELS, type Deadline} from '../deadlines/deadline.models';
import {DeadlinesApi} from '../deadlines/deadlines.api';
import {DashboardApi} from './dashboard.api';
import {growth, rateOfCa, taxes, thresholds} from './dashboard-summary';
import type {Dashboard} from './dashboard.models';
import {monthlyChart} from './monthly-chart';

@Component({
    selector: 'app-dashboard',
    imports: [
        RouterLink,
        ReplaceUrlLinks,
        NgIcon,
        NgxEchartsDirective,
        EurPipe,
        FrDatePipe,
        HlmBadgeImports,
        HlmButtonImports,
        HlmCardImports,
        HlmSkeletonImports,
        KpiTile,
        PageHeader,
    ],
    providers: [provideIcons({lucideTrendingUp, lucideTrendingDown, lucideArrowRight, lucideCheck, lucideClock})],
    templateUrl: './dashboard.page.html',
})
export class DashboardPage {
    private readonly api = inject(DashboardApi);
    private readonly deadlinesApi = inject(DeadlinesApi);

    protected readonly year = signal(new Date().getFullYear());
    protected readonly data = signal<Dashboard | null>(null);
    protected readonly error = signal('');

    protected readonly yearOptions = computed(() => {
        const current = new Date().getFullYear();
        const ys = new Set([current, this.year(), ...(this.data()?.years ?? [])]);
        return [...ys].sort((a, b) => b - a);
    });

    protected readonly growth = computed(() => {
        const d = this.data();
        return d && growth(d);
    });
    protected readonly thresholds = computed(() => {
        const d = this.data();
        return d ? thresholds(d) : [];
    });
    protected readonly taxes = computed(() => {
        const d = this.data();
        return d ? taxes(d) : {total: 0, lines: []};
    });
    protected readonly chart = computed(() => monthlyChart(this.data()));

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
            this.data.set(await this.api.get(this.year()));
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    async markDone(dl: Deadline) {
        try {
            await this.deadlinesApi.setDone(dl.id, true);
            toast.success('Échéance marquée comme effectuée', {
                action: {label: 'Annuler', onClick: () => void this.undo(dl)},
            });
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }

    private async undo(dl: Deadline) {
        await this.deadlinesApi.setDone(dl.id, false);
        await this.load();
    }

    protected rateOfCa(d: Dashboard, cents: number) {
        return rateOfCa(d, cents);
    }
    protected isLate(dl: Deadline) {
        return daysUntil(dl.dueOn) < 0;
    }
    protected rel(iso: string) {
        return relativeDays(iso);
    }
    protected kindLabel(dl: Deadline) {
        return KIND_LABELS[dl.kind];
    }
}
