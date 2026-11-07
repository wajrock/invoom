import {Component, input, output} from '@angular/core';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports} from '@spartan-ng/helm/dialog';
import {Spinner} from '../spinner/spinner';

/** Dialog footer with Cancel / submit buttons; projected content goes before them. */
@Component({
    selector: 'app-dialog-footer',
    imports: [HlmButtonImports, HlmDialogImports, Spinner],
    host: {class: 'contents'},
    template: `
        <hlm-dialog-footer class="flex-wrap">
            <ng-content />
            <button hlmBtn variant="outline" type="button" (click)="dismiss.emit()">Annuler</button>
            <button hlmBtn type="submit" [attr.form]="formId()" [disabled]="saving() || disabled()">
                @if (saving()) {
                    <app-spinner />
                }
                {{ submitLabel() }}
            </button>
        </hlm-dialog-footer>
    `,
})
export class DialogFooter {
    /** id of the <form> submitted by the main button */
    readonly formId = input.required<string>();
    readonly saving = input(false);
    readonly disabled = input(false);
    readonly submitLabel = input('Enregistrer');
    readonly dismiss = output<void>();
}
