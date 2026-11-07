import {Component, input} from '@angular/core';
import {HlmCardImports} from '@spartan-ng/helm/card';

/** Card shown when a list is empty; projected content holds the call-to-action buttons. */
@Component({
    selector: 'app-empty-state',
    imports: [HlmCardImports],
    host: {class: 'block'},
    template: `
        <section hlmCard class="items-center py-12 text-center">
            <p class="text-muted-foreground text-sm">{{ message() }}</p>
            <ng-content />
        </section>
    `,
})
export class EmptyState {
    readonly message = input.required<string>();
}
