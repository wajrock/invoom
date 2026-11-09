import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmTextareaImports} from '@spartan-ng/helm/textarea';
import {errorMessage} from '../../../core/http/error-message';
import {DateInput} from '../../../shared/ui/date-input/date-input';
import {DialogFooter} from '../../../shared/ui/dialog-footer/dialog-footer';
import {drawerOptions} from '../../../shared/ui/drawer/drawer';
import {todayIso} from '../../../shared/utils/dates';
import {centsToInput, parseEuros} from '../../../shared/utils/money';
import {KIND_OPTIONS, type Deadline, type DeadlineInput, type DeadlineKind} from '../deadline.models';
import {DeadlinesApi} from '../deadlines.api';

export interface DeadlineDialogContext {
    deadline?: Deadline;
}

/** Opens the custom deadline form in a right drawer; emits true when something was saved. */
export function openDeadlineDialog(dialog: HlmDialogService, context: DeadlineDialogContext) {
    return dialog.open<boolean, DeadlineDialogContext>(DeadlineDialog, drawerOptions(context)).closed$;
}

@Component({
    selector: 'app-deadline-dialog',
    imports: [
        FormsModule,
        DateInput,
        HlmDialogImports,
        HlmInputImports,
        HlmLabelImports,
        HlmTextareaImports,
        DialogFooter,
    ],
    host: {class: 'contents'},
    templateUrl: './deadline-dialog.html',
})
export class DeadlineDialog {
    private readonly api = inject(DeadlinesApi);
    protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
    protected readonly existing = injectBrnDialogContext<DeadlineDialogContext>().deadline;
    protected readonly kinds = KIND_OPTIONS;
    protected readonly saving = signal(false);
    protected readonly form = {
        title: this.existing?.title ?? '',
        dueOn: this.existing?.dueOn ?? todayIso(),
        kind: this.existing?.kind ?? ('autre' as DeadlineKind),
        amount: centsToInput(this.existing?.amount),
        note: this.existing?.note ?? '',
    };

    async save() {
        if (!this.form.title.trim()) return void toast.error('L’intitulé est requis');
        const amount = parseEuros(this.form.amount);
        if (this.form.amount.trim() && amount === null) return void toast.error('Montant invalide');
        const body: DeadlineInput = {...this.form, title: this.form.title.trim(), amount};
        this.saving.set(true);
        try {
            if (this.existing) await this.api.update(this.existing.id, body);
            else await this.api.create(body);
            toast.success(this.existing ? 'Échéance mise à jour' : 'Échéance ajoutée');
            this.ref.close(true);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
