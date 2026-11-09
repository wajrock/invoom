import {Component, input, output} from '@angular/core';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {deadlineStatus, KIND_LABELS, type Deadline} from '../deadline.models';
import {KindIcon} from '../kind-icon/kind-icon';

/** Compact deadline row: a tap opens the card, where it can be settled. */
@Component({
    selector: 'app-deadline-row',
    imports: [EurPipe, FrDatePipe, KindIcon],
    host: {class: 'flex items-center', '[class.opacity-60]': 'deadline().done'},
    templateUrl: './deadline-row.html',
})
export class DeadlineRow {
    readonly deadline = input.required<Deadline>();
    readonly open = output<void>();

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
