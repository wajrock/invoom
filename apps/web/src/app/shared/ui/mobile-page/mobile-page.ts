import {Component, input, output} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideX} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';

/** Full-screen page sliding up over the app on phones (hidden from `md`, where the sidebar takes over). */
@Component({
    selector: 'app-mobile-page',
    imports: [NgIcon, HlmButtonImports],
    providers: [provideIcons({lucideX})],
    host: {'(document:keydown.escape)': 'closed.emit()'},
    template: `
        <div
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="label()"
            class="bg-background animate-in slide-in-from-bottom fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] duration-300 ease-out md:hidden"
        >
            <header class="flex h-14 shrink-0 items-center justify-between border-b px-4">
                <ng-content select="[mobilePageTitle]" />
                <button hlmBtn variant="ghost" size="icon-sm" aria-label="Fermer" (click)="closed.emit()">
                    <ng-icon name="lucideX" />
                </button>
            </header>
            <div
                class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            >
                <ng-content />
            </div>
        </div>
    `,
})
export class MobilePage {
    /** Accessible name; the visible title is projected with the mobilePageTitle attribute */
    readonly label = input.required<string>();
    readonly closed = output<void>();
}
