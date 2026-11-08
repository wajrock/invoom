import {Component, input, model} from '@angular/core';

export interface SegmentOption<T extends string> {
    value: T;
    label: string;
}

/** Pick one of a few options, shown side by side. */
@Component({
    selector: 'app-segmented-control',
    host: {class: 'bg-muted grid auto-cols-fr grid-flow-col gap-1 rounded-lg p-1', role: 'group'},
    template: `
        @for (o of options(); track o.value) {
            <button
                type="button"
                class="rounded-md px-3 py-2 text-sm font-medium transition-colors"
                [class]="
                    value() === o.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                "
                [attr.aria-pressed]="value() === o.value"
                (click)="value.set(o.value)"
            >
                {{ o.label }}
            </button>
        }
    `,
})
export class SegmentedControl<T extends string> {
    readonly options = input.required<SegmentOption<T>[]>();
    readonly value = model.required<T>();
}
