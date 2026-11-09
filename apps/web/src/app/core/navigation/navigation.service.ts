import {inject, Injectable} from '@angular/core';
import {type NavigationBehaviorOptions, Router, type UrlCreationOptions, type UrlTree} from '@angular/router';

/** Opened from the Home Screen icon (iOS sets navigator.standalone, other browsers the display mode) */
function isInstalledApp(): boolean {
    const standalone = (navigator as Navigator & {standalone?: boolean}).standalone;
    return standalone === true || matchMedia('(display-mode: standalone)').matches;
}

/**
 * App navigation.
 *
 * - Installed app: no history entries, so the iOS edge swipe has no in-app page to go back to. The router
 *   replaces the URL (`replaceUrl`, i.e. `history.replaceState`) instead of pushing a new one.
 * - Browser: normal navigation, the back button goes to the previous page.
 *
 * Links get the same behaviour through ReplaceUrlLinks.
 */
@Injectable({providedIn: 'root'})
export class NavigationService {
    private readonly router = inject(Router);

    readonly installed = isInstalledApp();

    navigate(commands: readonly unknown[], extras: UrlCreationOptions & NavigationBehaviorOptions = {}) {
        return this.navigateByUrl(this.router.createUrlTree(commands, extras), extras);
    }

    navigateByUrl(url: string | UrlTree, extras: NavigationBehaviorOptions = {}): Promise<boolean> {
        return this.router.navigateByUrl(url, this.installed ? {...extras, replaceUrl: true} : extras);
    }
}
