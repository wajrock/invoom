import {Component, computed, input, output} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCircleCheck, lucideClock} from '@ng-icons/lucide';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {groupByMonth} from '../../../shared/utils/dates';
import type {Payment} from '../payment.models';

/** Mobile list of payments, grouped by issue month. */
@Component({
    selector: 'app-payment-list',
    imports: [NgIcon, EurPipe, FrDatePipe],
    providers: [provideIcons({lucideCircleCheck, lucideClock})],
    host: {class: 'grid gap-5'},
    templateUrl: './payment-list.html',
})
export class PaymentList {
    readonly payments = input.required<Payment[]>();
    readonly pick = output<Payment>();
    protected readonly groups = computed(() => groupByMonth(this.payments(), (p) => p.issuedOn));
}
