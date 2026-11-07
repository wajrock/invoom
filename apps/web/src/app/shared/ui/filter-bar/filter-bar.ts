import {Component, input, model} from '@angular/core';
import {SearchInput} from '../search-input/search-input';

/** Search field followed by the projected filter <select>s. */
@Component({
    selector: 'app-filter-bar',
    imports: [SearchInput],
    host: {class: 'mb-4 flex flex-wrap items-center gap-2 max-sm:[&>select]:flex-1'},
    template: `
        <app-search-input class="min-w-48 flex-1 max-sm:basis-full" [placeholder]="placeholder()" [(value)]="query" />
        <ng-content />
    `,
})
export class FilterBar {
    readonly query = model('');
    readonly placeholder = input('');
}
