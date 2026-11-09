import {Component, input, output} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {ReplaceUrlLinks} from '../core/navigation/replace-url-links';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideEllipsis} from '@ng-icons/lucide';
import {NAV_ICONS, TABS} from './nav';

/** Mobile bottom tab bar. */
@Component({
    selector: 'app-tab-bar',
    imports: [RouterLink, ReplaceUrlLinks, RouterLinkActive, NgIcon],
    providers: [provideIcons({...NAV_ICONS, lucideEllipsis})],
    templateUrl: './tab-bar.html',
})
export class TabBar {
    protected readonly tabs = TABS;
    /** A "Plus" page is the current route */
    readonly moreActive = input(false);
    readonly moreOpen = input(false);
    readonly openMore = output<void>();
}
