import {Component, input, output} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideTrash2} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports} from '@spartan-ng/helm/dialog';

/**
 * Footer of a detail card: the projected buttons, then "Supprimer".
 * Phones: buttons on one row, delete below; larger screens: delete on the left, buttons on the right.
 */
@Component({
    selector: 'app-detail-footer',
    imports: [NgIcon, HlmButtonImports, HlmDialogImports],
    providers: [provideIcons({lucideTrash2})],
    host: {class: 'contents'},
    template: `
        <hlm-dialog-footer class="sm:flex-row-reverse sm:justify-between">
            <div class="flex gap-2 max-sm:*:flex-1">
                <ng-content />
            </div>
            @if (removable()) {
                <button hlmBtn variant="ghost" class="text-destructive" (click)="remove.emit()">
                    <ng-icon name="lucideTrash2" /> Supprimer
                </button>
            }
        </hlm-dialog-footer>
    `,
})
export class DetailFooter {
    /** False for items that cannot be deleted (generated deadlines) */
    readonly removable = input(true);
    readonly remove = output<void>();
}
