import {Component, inject, output} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ReplaceUrlLinks} from '../core/navigation/replace-url-links';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronRight, lucideLogOut, lucideMoon, lucideSun} from '@ng-icons/lucide';
import {ThemeService} from '../core/theme.service';
import {Logo} from '../shared/ui/logo/logo';
import {MobilePage} from '../shared/ui/mobile-page/mobile-page';
import {MORE_GROUPS, NAV_ICONS} from './nav';

/** Mobile "Plus" page: secondary pages, theme and sign-out. */
@Component({
    selector: 'app-more-sheet',
    imports: [RouterLink, ReplaceUrlLinks, NgIcon, Logo, MobilePage],
    providers: [provideIcons({...NAV_ICONS, lucideChevronRight, lucideLogOut, lucideMoon, lucideSun})],
    templateUrl: './more-sheet.html',
})
export class MoreSheet {
    protected readonly theme = inject(ThemeService);
    protected readonly groups = MORE_GROUPS;
    readonly closed = output<void>();
    readonly logout = output<void>();
}
