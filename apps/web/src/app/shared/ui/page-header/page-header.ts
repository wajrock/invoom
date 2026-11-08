import {Component, input} from '@angular/core';

/**
 * Page title and subtitle; projected content (actions) is aligned on the right.
 * Level 2 titles a section inside a page with its own heading (e.g. a settings tab).
 */
@Component({
    selector: 'app-page-header',
    host: {class: 'page-head'},
    template: `
        <div>
            @if (level() === 2) {
                <h2>{{ heading() }}</h2>
            } @else {
                <h1>{{ heading() }}</h1>
            }
            @if (subtitle()) {
                <p class="text-muted-foreground text-sm">{{ subtitle() }}</p>
            }
        </div>
        <ng-content />
    `,
})
export class PageHeader {
    readonly heading = input.required<string>();
    readonly subtitle = input<string | null>(null);
    readonly level = input<1 | 2>(1);
}
