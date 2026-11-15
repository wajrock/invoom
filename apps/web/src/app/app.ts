import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {Toaster} from './shared/ui/toaster/toaster';

/**
 * Root: pages, toasts and the iOS status bar strip.
 *
 * The strip behind the iOS status bar keeps scrolled content from showing under the clock and Dynamic Island,
 * and gives Safari 26 a solid element in the page colour to tint the bar from. It sits above the toasts too: a toast
 * sliding in under the status bar would otherwise give the bar its colour.
 */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, Toaster],
    template: `
        <router-outlet />
        <div
            aria-hidden="true"
            class="bg-background pointer-events-none fixed inset-x-0 top-0 z-[2147483647] h-[max(1px,env(safe-area-inset-top))]"
        ></div>
        <app-toaster />
    `,
})
export class App {}
