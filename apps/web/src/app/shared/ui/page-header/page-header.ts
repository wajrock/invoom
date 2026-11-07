import {Component, input} from '@angular/core';

/** Page title and subtitle; projected content (actions) is aligned on the right. */
@Component({
    selector: 'app-page-header',
    host: {class: 'page-head'},
    template: `
        <div>
            <h1>{{ heading() }}</h1>
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
}
