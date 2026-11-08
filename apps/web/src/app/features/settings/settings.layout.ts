import {Component} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {NAV_ICONS, SETTINGS_TABS} from '../../layout/nav';
import {PageHeader} from '../../shared/ui/page-header/page-header';

/** Settings page: one tab per section (company, tax, security). */
@Component({
    selector: 'app-settings-layout',
    imports: [RouterLink, RouterLinkActive, RouterOutlet, NgIcon, PageHeader],
    providers: [provideIcons(NAV_ICONS)],
    template: `
        <app-page-header heading="Paramètres" />
        <nav class="mb-6 flex gap-1 overflow-x-clip border-b" aria-label="Sections des paramètres">
            @for (tab of tabs; track tab.path) {
                <a
                    [routerLink]="tab.path"
                    routerLinkActive
                    #rla="routerLinkActive"
                    [attr.aria-current]="rla.isActive ? 'page' : null"
                    class="-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
                    [class]="
                        rla.isActive
                            ? 'border-foreground text-foreground'
                            : 'text-muted-foreground hover:text-foreground border-transparent'
                    "
                >
                    <ng-icon [name]="tab.icon" class="text-base" />
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
