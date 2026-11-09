import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideUserPlus} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {DateInput} from '../../../shared/ui/date-input/date-input';
import {CURRENCIES} from '../../../shared/utils/money';
import {openClientDialog} from '../../clients/client-dialog/client-dialog';
import {InvoiceEditor} from '../invoice-editor';

/** Client and language, then number, dates, period, currency and VAT rate. */
@Component({
    selector: 'app-invoice-header',
    imports: [
        FormsModule,
        NgIcon,
        FrDatePipe,
        DateInput,
        HlmButtonImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSwitchImports,
    ],
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
