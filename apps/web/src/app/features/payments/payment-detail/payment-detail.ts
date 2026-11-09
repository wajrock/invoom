import {Component, inject} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCircleCheck, lucideFileText, lucidePencil} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {MoneyPipe} from '../../../shared/pipes/money.pipe';
import {Avatar} from '../../../shared/ui/avatar/avatar';
import {DetailFooter} from '../../../shared/ui/detail-footer/detail-footer';
import {drawerOptions} from '../../../shared/ui/drawer/drawer';
import {formatDate, formatPeriod} from '../../../shared/utils/dates';
import {filesInOrder, LANG_LABELS, type Payment, type PaymentAction} from '../payment.models';
import {PaymentsApi} from '../payments.api';

export interface PaymentDetailContext {
    payment: Payment;
}

/** Opens the payment card; emits the action picked, or undefined when closed. */
export function openPaymentDetail(dialog: HlmDialogService, context: PaymentDetailContext) {
    return dialog.open<PaymentAction | undefined, PaymentDetailContext>(PaymentDetail, drawerOptions(context)).closed$;
}

/** Read-only payment card: amount and status, invoice details, invoice files and actions. */
@Component({
    selector: 'app-payment-detail',
    imports: [NgIcon, EurPipe, MoneyPipe, HlmButtonImports, HlmDialogImports, Avatar, DetailFooter],
    providers: [provideIcons({lucideCircleCheck, lucideFileText, lucidePencil})],
    host: {class: 'contents'},
    templateUrl: './payment-detail.html',
})
export class PaymentDetail {
    protected readonly api = inject(PaymentsApi);
    protected readonly ref = inject<BrnDialogRef<PaymentAction | undefined>>(BrnDialogRef);
    protected readonly p = injectBrnDialogContext<PaymentDetailContext>().payment;

    protected readonly langLabels = LANG_LABELS;
    protected readonly files = filesInOrder(this.p.files);
    /** Invoice and cash-in details, only those known */
    protected readonly rows = [
        {label: 'N° de facture', value: this.p.invoiceNumber},
        {label: 'Émise le', value: formatDate(this.p.issuedOn)},
        {label: 'À régler avant le', value: this.p.invoice ? formatDate(this.p.invoice.dueOn) : ''},
        {label: 'Période', value: formatPeriod(this.p.invoice?.periodFrom, this.p.invoice?.periodTo)},
        {label: 'Encaissé le', value: this.p.paidOn ? formatDate(this.p.paidOn) : ''},
    ].filter((row) => row.value);

    protected close(action?: PaymentAction) {
        this.ref.close(action);
    }
}
