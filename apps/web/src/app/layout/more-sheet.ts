import {Component, inject, output} from '@angular/core';
import {RouterLink} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronRight, lucideLogOut, lucideMoon, lucideSun} from '@ng-icons/lucide';
import {ThemeService} from '../core/theme.service';
import {BottomSheet} from '../shared/ui/bottom-sheet/bottom-sheet';
import {MORE_GROUPS, NAV_ICONS} from './nav';

/** Mobile "Plus" sheet: secondary pages, theme and sign-out. */
@Component({
    selector: 'app-more-sheet',
    imports: [RouterLink, NgIcon, BottomSheet],
    providers: [provideIcons({...NAV_ICONS, lucideChevronRight, lucideLogOut, lucideMoon, lucideSun})],
    templateUrl: './more-sheet.html',
})
export class MoreSheet {
    protected readonly theme = inject(ThemeService);
    protected readonly groups = MORE_GROUPS;
    readonly closed = output<void>();
    readonly logout = output<void>();
}
