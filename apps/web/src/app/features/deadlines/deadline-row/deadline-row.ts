import {Component, input, output, type TemplateRef} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideEllipsis} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {deadlineStatus, KIND_LABELS, type Deadline} from '../deadline.models';
import {KindIcon} from '../kind-icon/kind-icon';

/** Compact deadline row: a tap opens the card, where it can be settled; larger screens add an actions menu. */
@Component({
    selector: 'app-deadline-row',
    imports: [EurPipe, FrDatePipe, KindIcon, NgIcon, HlmButtonImports, HlmDropdownMenuImports],
    providers: [provideIcons({lucideEllipsis})],
    host: {class: 'flex items-center', '[class.opacity-60]': 'deadline().done'},
    templateUrl: './deadline-row.html',
})
export class DeadlineRow {
    readonly deadline = input.required<Deadline>();
    readonly open = output<void>();
    /** Actions menu (larger screens), given the deadline as `$implicit` */
    readonly menu = input<TemplateRef<unknown> | null>(null);

    protected kindLabel(d: Deadline) {
        return KIND_LABELS[d.kind];
    }
    protected status(d: Deadline) {
        return deadlineStatus(d).label;
    }
    protected statusClass(d: Deadline) {
        return deadlineStatus(d).text;
    }
}
