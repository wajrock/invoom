import {Component, output} from '@angular/core';

/** Tappable row of a mobile list: the whole row is a button that opens the item's detail. */
@Component({
    selector: 'app-list-row',
    host: {class: 'flex'},
    template: `
        <button
            type="button"
            class="tap-row flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left"
            (click)="activate.emit()"
        >
            <ng-content />
        </button>
    `,
})
export class ListRow {
    readonly activate = output<void>();
}
