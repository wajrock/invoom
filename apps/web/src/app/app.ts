import {Component, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {HlmToasterImports} from '@spartan-ng/helm/sonner';
import {ThemeService} from './core/theme.service';

/**
 * Root: pages, toasts and the iOS status bar strip.
 *
 * Toasts sit at the top: at the bottom they cover the mobile tab bar and the drawer's save button.
 * The strip behind the iOS status bar keeps scrolled content from showing under the clock and Dynamic Island,
 * and gives Safari 26 a solid element in the page colour to tint the bar from.
 */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, HlmToasterImports],
    template: `
        <router-outlet />
        <div
            aria-hidden="true"
            class="bg-background pointer-events-none fixed inset-x-0 top-0 z-[1001] h-[max(1px,env(safe-area-inset-top))]"
        ></div>
        <hlm-toaster [theme]="theme.theme()" position="top-center" richColors />
    `,
})
export class App {
    protected readonly theme = inject(ThemeService);
}
