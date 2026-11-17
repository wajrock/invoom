import {Component, computed, inject, output} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronsUpDown, lucideLogOut, lucideSettings} from '@ng-icons/lucide';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {Auth} from '../core/auth/auth.service';
import {NavigationService} from '../core/navigation/navigation.service';
import {Avatar} from '../shared/ui/avatar/avatar';
import {SETTINGS} from './nav';

/** Signed-in account at the bottom of the sidebar, with a menu: name and email, settings and sign-out. */
@Component({
    selector: 'app-account-menu',
    imports: [NgIcon, HlmDropdownMenuImports, Avatar],
    providers: [provideIcons({lucideChevronsUpDown, lucideLogOut, lucideSettings})],
    template: `
        <button
            type="button"
            class="group flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left"
            [hlmDropdownMenuTrigger]="menu"
            side="top"
            align="start"
            aria-label="Compte"
        >
            <app-avatar [name]="label()" class="size-7! text-[11px]!" />
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ label() }}</span>
            <ng-icon
                name="lucideChevronsUpDown"
                class="text-muted-foreground group-hover:text-foreground group-aria-expanded:text-foreground shrink-0 transition-colors"
            />
        </button>

        <ng-template #menu>
            <hlm-dropdown-menu class="w-56">
                @if (auth.account(); as me) {
                    <div class="px-2 pt-1 pb-1.5">
                        <p class="truncate text-sm font-medium">{{ label() }}</p>
                        @if (me.name) {
                            <p class="text-muted-foreground truncate text-xs">{{ me.email }}</p>
                        }
                    </div>
                    <hlm-dropdown-menu-separator />
                }
                <button hlmDropdownMenuItem (click)="nav.navigateByUrl(settings.path)">
                    <ng-icon name="lucideSettings" /> {{ settings.label }}
                </button>
                <button hlmDropdownMenuItem variant="destructive" (click)="logout.emit()">
                    <ng-icon name="lucideLogOut" /> Se déconnecter
                </button>
            </hlm-dropdown-menu>
        </ng-template>
    `,
})
export class AccountMenu {
    protected readonly auth = inject(Auth);
    protected readonly nav = inject(NavigationService);
    protected readonly settings = SETTINGS;
    readonly logout = output<void>();

    /** Business name, or the email until it is filled in */
    protected readonly label = computed(() => {
        const a = this.auth.account();
        return a?.name || a?.email || 'Mon compte';
    });

    constructor() {
        void this.auth.loadAccount();
    }
}
