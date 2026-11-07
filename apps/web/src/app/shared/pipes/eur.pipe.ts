import {Pipe, type PipeTransform} from '@angular/core';
import {formatCents} from '../utils/money';

@Pipe({name: 'eur'})
export class EurPipe implements PipeTransform {
    transform(cents: number | null | undefined, round = false): string {
        return formatCents(cents, round);
    }
}
