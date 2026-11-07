import {Component, inject, input, output} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {
    lucideCircleCheck,
    lucideClock,
    lucideEllipsis,
    lucideFilePlus,
    lucideFileText,
    lucidePencil,
    lucideTrash2,
} from '@ng-icons/lucide';
import {HlmBadgeImports} from '@spartan-ng/helm/badge';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {HlmTableImports} from '@spartan-ng/helm/table';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {MoneyPipe} from '../../../shared/pipes/money.pipe';
import {LANG_LABELS, type Payment, type PaymentAction} from '../payment.models';
import {PaymentsApi} from '../payments.api';

export interface PaymentActionEvent {
    payment: Payment;
    action: PaymentAction;
}

/** Desktop list of payments; a row click edits the payment. */
@Component({
    selector: 'app-payments-table',
    imports: [
        NgIcon,
        EurPipe,
        FrDatePipe,
        MoneyPipe,
        HlmBadgeImports,
        HlmButtonImports,
        HlmDropdownMenuImports,
        HlmTableImports,
    ],
    providers: [
        provideIcons({
            lucideCircleCheck,
            lucideClock,
            lucideEllipsis,
            lucideFilePlus,
            lucideFileText,
            lucidePencil,
            lucideTrash2,
        }),
    ],
    templateUrl: './payments-table.html',
})
export class PaymentsTable {
    protected readonly api = inject(PaymentsApi);
    protected readonly langLabels = LANG_LABELS;
    readonly payments = input.required<Payment[]>();
    readonly action = output<PaymentActionEvent>();

    protected emit(payment: Payment, action: PaymentAction) {
        this.action.emit({payment, action});
    }
}
