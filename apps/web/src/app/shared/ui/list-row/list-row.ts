import {Component, output} from '@angular/core';

/**
 * Tappable row of a mobile list. The main area is a real button; an element marked
 * `listRowAction` (e.g. a menu trigger) is rendered next to it.
 */
@Component({
    selector: 'app-list-row',
    host: {class: 'flex items-center gap-3 pr-1'},
    template: `
        <button
            type="button"
            class="tap-row flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
            (click)="activate.emit()"
        >
            <ng-content />
        </button>
        <ng-content select="[listRowAction]" />
    `,
})
export class ListRow {
    readonly activate = output<void>();
}
