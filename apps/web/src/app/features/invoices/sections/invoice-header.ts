import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideUserPlus} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {DateInput} from '../../../shared/ui/date-input/date-input';
import {CURRENCIES} from '../../../shared/utils/money';
import {openClientDialog} from '../../clients/client-dialog/client-dialog';
import {InvoiceEditor} from '../invoice-editor';

/** Client, number, dates, currency and VAT rate. */
@Component({
    selector: 'app-invoice-header',
    imports: [FormsModule, NgIcon, DateInput, HlmButtonImports, HlmInputImports, HlmLabelImports],
    providers: [provideIcons({lucideUserPlus})],
    host: {class: 'contents'},
    templateUrl: './invoice-header.html',
})
export class InvoiceHeader {
    protected readonly editor = inject(InvoiceEditor);
    private readonly dialog = inject(HlmDialogService);
    protected readonly form = this.editor.form;
    protected readonly currencies = CURRENCIES;

    newClient() {
        openClientDialog(this.dialog, {}).subscribe((client) => {
            if (client) this.editor.addClient(client);
        });
    }
}
