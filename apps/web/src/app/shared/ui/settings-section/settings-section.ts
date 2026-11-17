import {Component, input} from '@angular/core';

/**
 * One block of a settings page: title and explanation, then the settings themselves. Sections follow each other
 * with a rule between them, not above the first whatever precedes it (buttons, a banner). Extra content under the
 * explanation (a badge, a note…) goes in `[sectionAside]`, a button on the right of the title in `[sectionAction]`.
 */
@Component({
    selector: 'app-settings-section',
    host: {
        class: 'grid gap-4 border-t py-8 first-of-type:border-t-0 first-of-type:pt-0 last-of-type:pb-0',
    },
    template: `
        <div class="flex items-center justify-between gap-4">
            <div class="grid gap-1.5">
                <h2 class="font-display text-lg leading-6 font-semibold">{{ heading() }}</h2>
                @if (description()) {
                    <p class="text-muted-foreground text-sm leading-relaxed text-pretty">{{ description() }}</p>
                }
                <ng-content select="[sectionAside]" />
            </div>
            <ng-content select="[sectionAction]" />
        </div>
        <div class="grid min-w-0 content-start gap-4"><ng-content /></div>
    `,
})
export class SettingsSection {
    readonly heading = input.required<string>();
    readonly description = input('');
}
