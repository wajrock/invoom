import {Component, input, output} from '@angular/core';

const HIDDEN_FROM = {sm: 'sm:hidden', md: 'md:hidden'} as const;

/** Mobile sheet sliding up from the bottom, over a dimmed backdrop. */
@Component({
    selector: 'app-bottom-sheet',
    host: {'(document:keydown.escape)': 'closed.emit()'},
    template: `
        <button
            type="button"
            tabindex="-1"
            aria-label="Fermer"
            class="animate-in fade-in-0 fixed inset-0 z-50 cursor-default bg-black/40 duration-200"
            [class]="hiddenClass()"
            (click)="closed.emit()"
        ></button>
        <div
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="label()"
            class="bg-background animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 rounded-t-2xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] duration-300 ease-out"
            [class]="hiddenClass()"
        >
            <div class="bg-muted-foreground/30 mx-auto mb-3 h-1 w-10 rounded-full"></div>
            <ng-content />
        </div>
    `,
})
export class BottomSheet {
    readonly label = input.required<string>();
    /** Breakpoint from which the sheet is hidden (desktop layouts use other UI) */
    readonly hiddenFrom = input<keyof typeof HIDDEN_FROM>('md');
    readonly closed = output<void>();

    protected hiddenClass() {
        return HIDDEN_FROM[this.hiddenFrom()];
    }
}
