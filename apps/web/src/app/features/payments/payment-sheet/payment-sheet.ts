import {Component, inject, input, output} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCircleCheck, lucideFilePlus, lucideFileText, lucidePencil, lucideTrash2} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {MoneyPipe} from '../../../shared/pipes/money.pipe';
import {BottomSheet} from '../../../shared/ui/bottom-sheet/bottom-sheet';
import {LANG_LABELS, type Payment, type PaymentAction} from '../payment.models';
import {PaymentsApi} from '../payments.api';

/** Mobile action sheet of a payment. */
@Component({
    selector: 'app-payment-sheet',
    imports: [NgIcon, EurPipe, FrDatePipe, MoneyPipe, HlmButtonImports, BottomSheet],
    providers: [provideIcons({lucideCircleCheck, lucideFilePlus, lucideFileText, lucidePencil, lucideTrash2})],
    templateUrl: './payment-sheet.html',
})
export class PaymentSheet {
    protected readonly api = inject(PaymentsApi);
    protected readonly langLabels = LANG_LABELS;
    readonly payment = input.required<Payment>();
    readonly action = output<PaymentAction>();
    readonly closed = output<void>();
}
