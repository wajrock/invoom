import {Component, input} from '@angular/core';
import {EmptyIllustration, type EmptyIllustrationName} from './empty-illustration';

/**
 * Shown in place of an empty list: an illustration, what is missing and why it matters, then the call to action (projected
 * content), which takes the place of the page header's button while there is nothing yet.
 */
@Component({
    selector: 'app-empty-state',
    imports: [EmptyIllustration],
    host: {
        class: 'bg-card flex flex-col items-center gap-4 rounded-xl border px-6 py-8 text-center sm:py-10',
    },
    template: `
        @if (illustration(); as name) {
            <app-empty-illustration class="w-44" [name]="name" />
        }
        <div class="grid max-w-sm gap-1">
            <p class="font-medium">{{ message() }}</p>
            @if (description()) {
                <p class="text-muted-foreground text-sm text-pretty">{{ description() }}</p>
            }
        </div>
        <ng-content />
    `,
})
export class EmptyState {
    readonly message = input.required<string>();
    readonly description = input('');
    readonly illustration = input<EmptyIllustrationName | null>(null);
}
