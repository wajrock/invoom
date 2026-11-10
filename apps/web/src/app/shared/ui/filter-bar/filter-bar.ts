import {booleanAttribute, Component, ElementRef, inject, input, model, signal} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideListFilter} from '@ng-icons/lucide';
import {SearchInput} from '../search-input/search-input';

let nextId = 0;

/**
 * Search field followed by the projected filters. On phones the filters move into a menu behind a filter
 * button, so the search keeps the whole row. Project each filter as
 * `<label class="filter-field"><span>Année</span><select class="select-native">…</select></label>`:
 * the caption shows in the menu only.
 */
@Component({
    selector: 'app-filter-bar',
    imports: [SearchInput, NgIcon],
    providers: [provideIcons({lucideListFilter})],
    host: {
        class: 'relative mb-4 flex items-center gap-2 sm:flex-wrap',
        '(document:click)': 'closeOutside($event)',
        '(document:keydown.escape)': 'open.set(false)',
    },
    template: `
        <app-search-input class="min-w-0 flex-1 sm:min-w-48" [placeholder]="placeholder()" [(value)]="query" />
        <button
            type="button"
            class="border-input bg-field text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 relative grid size-10 shrink-0 place-items-center rounded-md border shadow-xs outline-none focus-visible:ring-3 sm:hidden"
            aria-label="Filtres"
            [attr.aria-expanded]="open()"
            [attr.aria-controls]="panelId"
            (click)="open.set(!open())"
        >
            <ng-icon name="lucideListFilter" />
            @if (active()) {
                <span
                    class="bg-primary ring-background absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2"
                ></span>
            }
        </button>
        <div
            [id]="panelId"
            class="sm:contents max-sm:bg-popover max-sm:absolute max-sm:top-full max-sm:right-0 max-sm:z-30 max-sm:mt-2 max-sm:grid max-sm:w-64 max-sm:gap-3 max-sm:rounded-lg max-sm:border max-sm:p-3 max-sm:shadow-lg"
            [class.max-sm:hidden]="!open()"
        >
            <ng-content />
        </div>
    `,
})
export class FilterBar {
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    readonly query = model('');
    readonly placeholder = input('');
    /** A filter differs from its default: flags the phone button */
    readonly active = input(false, {transform: booleanAttribute});

    protected readonly open = signal(false);
    protected readonly panelId = `filters-${nextId++}`;

    protected closeOutside(event: Event) {
        if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
    }
}
