import {Component, computed, input, output} from '@angular/core';
import {EurPipe} from '../../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../../shared/pipes/fr-date.pipe';
import {Avatar} from '../../../shared/ui/avatar/avatar';
import {groupByMonth} from '../../../shared/utils/dates';
import type {Payment} from '../payment.models';

/** Phone list of payments, grouped by issue month: a tap opens the payment card. */
@Component({
    selector: 'app-payment-list',
    imports: [Avatar, EurPipe, FrDatePipe],
    host: {class: 'grid grid-cols-1 gap-5'},
    templateUrl: './payment-list.html',
})
export class PaymentList {
    readonly payments = input.required<Payment[]>();
    readonly pick = output<Payment>();
    protected readonly groups = computed(() => groupByMonth(this.payments(), (p) => p.issuedOn));
}
