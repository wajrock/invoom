import {Component, inject, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {HlmToasterImports} from '@spartan-ng/helm/sonner';
import {ThemeService} from './core/theme.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, HlmToasterImports],
    template: `
        <router-outlet />
        <hlm-toaster [theme]="theme.theme()" [position]="mobile() ? 'top-center' : 'bottom-right'" richColors />
    `,
})
export class App {
    protected readonly theme = inject(ThemeService);

    /** On mobile, toasts appear at the top so they don't cover the tab bar */
    private readonly query = matchMedia('(width < 48rem)');
    protected readonly mobile = signal(this.query.matches);

    constructor() {
        this.query.addEventListener('change', (e) => this.mobile.set(e.matches));
    }
}
