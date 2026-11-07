import {Pipe, type PipeTransform} from '@angular/core';
import {formatDate} from '../utils/dates';

@Pipe({name: 'frDate'})
export class FrDatePipe implements PipeTransform {
    transform(iso: string | null | undefined, style: 'long' | 'short' = 'long'): string {
        return formatDate(iso, style);
    }
}
