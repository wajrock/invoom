import {Logo} from '../shared/ui/logo/logo';
import {Component, inject, output} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideLogOut, lucideMoon, lucideSun} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {ThemeService} from '../core/theme.service';
import {NAV, NAV_ICONS} from './nav';

/** Side navigation (landscape tablet and desktop). */
@Component({
    selector: 'app-sidebar',
    imports: [RouterLink, RouterLinkActive, NgIcon, HlmButtonImports, Logo],
    providers: [provideIcons({...NAV_ICONS, lucideLogOut, lucideMoon, lucideSun})],
    templateUrl: './sidebar.html',
})
export class Sidebar {
    protected readonly theme = inject(ThemeService);
    protected readonly nav = NAV;
    readonly logout = output<void>();

    protected themeLabel() {
        return this.theme.theme() === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre';
    }
}
