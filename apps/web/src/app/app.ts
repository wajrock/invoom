import {Component, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {HlmToasterImports} from '@spartan-ng/helm/sonner';
import {ThemeService} from './core/theme.service';

/** Toasts sit at the top: at the bottom they cover the mobile tab bar and the drawer's save button. */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, HlmToasterImports],
    template: `
        <router-outlet />
        <hlm-toaster [theme]="theme.theme()" position="top-center" richColors />
    `,
})
export class App {
    protected readonly theme = inject(ThemeService);
}
