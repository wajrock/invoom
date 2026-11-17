import {Component, inject} from '@angular/core';
import {ThemeService} from '../../../core/theme.service';
import {HlmToasterImports} from '@spartan-ng/helm/sonner';

/**
 * App toasts: at the top (at the bottom they cover the mobile tab bar and the drawer's save button), in the page
 * colour. Safari 26 tints the status bar with the colour of a fixed element near the top, which a toast is: in the
 * page colour, the bar does not change. The kind of message shows in the icon colour instead.
 * Their position below the iOS status bar is set in styles.css (the library fixes it with its own CSS on phones).
 */
@Component({
    selector: 'app-toaster',
    imports: [HlmToasterImports],
    template: `<hlm-toaster position="top-center" [theme]="theme.theme()" [style]="style" [toastOptions]="options" />`,
})
export class Toaster {
    protected readonly theme = inject(ThemeService);
    protected readonly style = {
        '--normal-bg': 'var(--background)',
        '--normal-text': 'var(--foreground)',
        '--normal-border': 'var(--border)',
        '--border-radius': 'var(--radius)',
    };
    protected readonly options = {
        classes: {
            success: '[&_[data-icon]]:text-success',
            error: '[&_[data-icon]]:text-destructive',
            warning: '[&_[data-icon]]:text-warning',
            info: '[&_[data-icon]]:text-primary',
        },
    };
}
