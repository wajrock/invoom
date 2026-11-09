import {Component, inject} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCircle, lucideCircleCheck, lucidePencil} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {DetailFooter} from '../../../shared/ui/detail-footer/detail-footer';
import {drawerOptions} from '../../../shared/ui/drawer/drawer';
import {formatDate, isoDate} from '../../../shared/utils/dates';
import {deadlineStatus, KIND_LABELS, type Deadline} from '../deadline.models';
import {KindIcon} from '../kind-icon/kind-icon';

export interface DeadlineDetailContext {
    deadline: Deadline;
}

export type DeadlineDetailAction = 'toggle' | 'edit' | 'delete';

/** Opens the deadline card; emits the action picked, or undefined when closed. */
export function openDeadlineDetail(dialog: HlmDialogService, context: DeadlineDetailContext) {
    return dialog.open<DeadlineDetailAction | undefined, DeadlineDetailContext>(DeadlineDetail, drawerOptions(context))
        .closed$;
}

/** Read-only deadline card: amount, status, dates and the full note. */
@Component({
    selector: 'app-deadline-detail',
    imports: [NgIcon, EurPipe, HlmButtonImports, HlmDialogImports, DetailFooter, KindIcon],
    providers: [provideIcons({lucideCircle, lucideCircleCheck, lucidePencil})],
    host: {class: 'contents'},
    templateUrl: './deadline-detail.html',
})
export class DeadlineDetail {
    protected readonly ref = inject<BrnDialogRef<DeadlineDetailAction | undefined>>(BrnDialogRef);
    protected readonly d = injectBrnDialogContext<DeadlineDetailContext>().deadline;

    protected readonly kind = KIND_LABELS[this.d.kind];
    protected readonly status = deadlineStatus(this.d);
    protected readonly rows = [
        {label: 'Échéance', value: formatDate(this.d.dueOn)},
        {label: 'Réglée le', value: this.d.done && this.d.doneAt ? formatDate(isoDate(new Date(this.d.doneAt))) : ''},
        {label: 'Type', value: this.d.auto ? `${this.kind} · calculée par Invoom` : this.kind},
    ].filter((row) => row.value);

    protected close(action?: DeadlineDetailAction) {
        this.ref.close(action);
    }
}
