import {Component, computed, input} from '@angular/core';

const STYLES = {
    card: {
        host: 'ring-foreground/10 bg-card text-card-foreground flex flex-col gap-2 rounded-xl px-3.5 py-4 text-sm shadow-xs ring-1 sm:px-4',
        label: 'text-xs sm:text-sm',
        value: 'mt-1 text-xl sm:text-2xl',
    },
    compact: {
        host: 'bg-card rounded-xl border p-3 sm:p-4',
        label: 'text-xs',
        value: 'text-lg',
    },
};

/** Key figure: label, value and optional projected details. */
@Component({
    selector: 'app-kpi-tile',
    host: {'[class]': 'style().host'},
    template: `
        <div>
            <p class="text-muted-foreground" [class]="style().label">{{ label() }}</p>
            <p class="font-semibold tabular-nums" [class]="style().value">{{ value() }}</p>
            <ng-content />
        </div>
    `,
})
export class KpiTile {
    readonly label = input.required<string>();
    readonly value = input.required<string>();
    readonly variant = input<keyof typeof STYLES>('card');
    protected readonly style = computed(() => STYLES[this.variant()]);
}
