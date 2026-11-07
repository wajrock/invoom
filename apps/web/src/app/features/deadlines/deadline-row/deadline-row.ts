import {Component, input, output} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCircle, lucideCircleCheck, lucidePencil, lucideTrash2} from '@ng-icons/lucide';
import {HlmBadgeImports} from '@spartan-ng/helm/badge';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {daysUntil, relativeDays} from '../../../shared/utils/dates';
import {KIND_LABELS, type Deadline} from '../deadline.models';

@Component({
    selector: 'app-deadline-row',
    imports: [NgIcon, EurPipe, FrDatePipe, HlmBadgeImports, HlmButtonImports],
    providers: [provideIcons({lucideCircle, lucideCircleCheck, lucidePencil, lucideTrash2})],
    host: {class: 'flex items-start gap-3 p-3', '[class.opacity-60]': 'deadline().done'},
    templateUrl: './deadline-row.html',
})
export class DeadlineRow {
    readonly deadline = input.required<Deadline>();
    readonly toggleDone = output<void>();
    readonly edit = output<void>();
    readonly remove = output<void>();

    protected late(d: Deadline) {
        return daysUntil(d.dueOn) < 0;
    }
    protected rel(iso: string) {
        return relativeDays(iso);
    }
    protected kindLabel(d: Deadline) {
        return KIND_LABELS[d.kind];
    }
}
