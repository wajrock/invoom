import {Pipe, type PipeTransform} from '@angular/core';
import {formatMoney} from '../utils/money';

/** Cents in any currency → "1 234,56 $US" */
@Pipe({name: 'money'})
export class MoneyPipe implements PipeTransform {
    transform(cents: number, currency: string): string {
        return formatMoney(cents, currency);
    }
}
