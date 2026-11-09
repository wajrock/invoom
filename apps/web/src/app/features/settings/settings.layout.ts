import {Component} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {ReplaceUrlLinks} from '../../core/navigation/replace-url-links';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {NAV_ICONS, SETTINGS_TABS} from '../../layout/nav';
import {PageHeader} from '../../shared/ui/page-header/page-header';

/** Settings page: one tab per section (company, tax, security). */
@Component({
    selector: 'app-settings-layout',
    imports: [RouterLink, ReplaceUrlLinks, RouterLinkActive, RouterOutlet, NgIcon, PageHeader],
    providers: [provideIcons(NAV_ICONS)],
    template: `
        <app-page-header heading="Paramètres" />
        <nav class="tab-nav" aria-label="Sections des paramètres">
            @for (tab of tabs; track tab.path) {
                <a
                    class="tab-link"
                    appReplaceUrl
                    [routerLink]="tab.path"
                    routerLinkActive
                    #rla="routerLinkActive"
                    [attr.aria-current]="rla.isActive ? 'page' : null"
                >
                    <ng-icon [name]="tab.icon" />
                    {{ tab.label }}
                </a>
            }
        </nav>
        <router-outlet />
    `,
})
export class SettingsLayout {
    protected readonly tabs = SETTINGS_TABS;
}
