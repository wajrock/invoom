import {Component, output} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ReplaceUrlLinks} from '../core/navigation/replace-url-links';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronRight, lucideLogOut} from '@ng-icons/lucide';
import {Logo} from '../shared/ui/logo/logo';
import {MobilePage} from '../shared/ui/mobile-page/mobile-page';
import {MORE_GROUPS, NAV_ICONS} from './nav';

/** Mobile "Plus" page: secondary pages and sign-out. */
@Component({
    selector: 'app-more-sheet',
    imports: [RouterLink, ReplaceUrlLinks, NgIcon, Logo, MobilePage],
    providers: [provideIcons({...NAV_ICONS, lucideChevronRight, lucideLogOut})],
    templateUrl: './more-sheet.html',
})
export class MoreSheet {
    protected readonly groups = MORE_GROUPS;
    readonly closed = output<void>();
    readonly logout = output<void>();
}
