import {NgTemplateOutlet} from '@angular/common';
import {booleanAttribute, Component, computed, ElementRef, inject, input, signal, viewChild} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideInfo} from '@ng-icons/lucide';

let nextId = 0;
const PANEL_WIDTH = 256;
const GUTTER = 16;

const STYLES = {
    card: {
        host: 'ring-border bg-card text-card-foreground flex flex-col gap-2 rounded-xl px-3.5 py-4 text-sm ring-1 sm:px-4',
        label: 'text-xs sm:text-sm',
        value: 'font-display mt-1 text-xl sm:text-2xl',
    },
    compact: {
        host: 'bg-card rounded-xl border p-3 sm:p-4',
        label: 'text-xs',
        value: 'font-display text-lg',
    },
};

/**
 * Key figure: label, value and optional projected details. With `detailsInTooltip`, the details move behind an
 * info icon (hover on desktop, tap on phones) so the tile only shows the label and the value.
 */
@Component({
    selector: 'app-kpi-tile',
    imports: [NgIcon, NgTemplateOutlet],
    providers: [provideIcons({lucideInfo})],
    host: {
        '[class]': 'style().host',
        '(document:click)': 'closeOutside($event)',
        '(document:keydown.escape)': 'open.set(false)',
    },
    template: `
        <div>
            <div class="flex items-center justify-between gap-2">
                <p class="text-muted-foreground" [class]="style().label">{{ label() }}</p>
                @if (detailsInTooltip()) {
                    <span class="relative -m-1.5 shrink-0">
                        <button
                            #trigger
                            type="button"
                            class="text-muted-foreground hover:text-foreground grid size-7 place-items-center rounded-md"
                            [attr.aria-label]="'Détails : ' + label()"
                            [attr.aria-expanded]="open()"
                            [attr.aria-controls]="detailsId"
                            (click)="onClick()"
                            (pointerenter)="hover($event, true)"
                            (pointerleave)="hover($event, false)"
                        >
                            <ng-icon name="lucideInfo" />
                        </button>
                        <div
                            role="tooltip"
                            [id]="detailsId"
                            class="bg-popover text-popover-foreground animate-in fade-in-0 absolute top-full z-30 mt-1 rounded-lg border p-3 text-sm shadow-lg [&>*]:mt-0!"
                            [class.hidden]="!open()"
                            [style.width.px]="panel().width"
                            [style.left.px]="panel().left"
                        >
                            <ng-container *ngTemplateOutlet="details" />
                        </div>
                    </span>
                }
            </div>
            <p class="font-semibold tabular-nums" [class]="style().value">{{ value() }}</p>
            @if (!detailsInTooltip()) {
                <ng-container *ngTemplateOutlet="details" />
            }
        </div>
        <ng-template #details><ng-content /></ng-template>
    `,
})
export class KpiTile {
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    readonly label = input.required<string>();
    readonly value = input.required<string>();
    readonly variant = input<keyof typeof STYLES>('card');
    readonly detailsInTooltip = input(false, {transform: booleanAttribute});

    protected readonly style = computed(() => STYLES[this.variant()]);
    protected readonly open = signal(false);
    protected readonly detailsId = `kpi-details-${nextId++}`;
    private readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');
    /** Panel under the icon, right-aligned on it but kept inside the viewport (left offset from the icon) */
    protected readonly panel = signal({width: PANEL_WIDTH, left: 0});

    protected toggle(on: boolean) {
        const button = this.trigger()?.nativeElement;
        if (on && button) {
            const rect = button.getBoundingClientRect();
            const viewport = document.documentElement.clientWidth;
            const width = Math.min(PANEL_WIDTH, viewport - 2 * GUTTER);
            const left = Math.min(Math.max(rect.right - width, GUTTER), viewport - GUTTER - width);
            this.panel.set({width, left: left - rect.left});
        }
        this.open.set(on);
    }

    /** Whether the last pointer over the icon was a mouse */
    private mouse = false;

    /** With a mouse the hover already opened it: a click must not close it again */
    protected onClick() {
        this.toggle(this.mouse || !this.open());
    }

    /** Only a mouse hover drives the panel; a touch also emits enter/leave around its tap, which toggles it */
    protected hover(event: PointerEvent, on: boolean) {
        this.mouse = event.pointerType === 'mouse';
        if (this.mouse) this.toggle(on);
    }

    protected closeOutside(event: Event) {
        if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
    }
}
