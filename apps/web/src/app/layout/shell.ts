import {Component, computed, DestroyRef, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {
    lucideBuilding2,
    lucideCalendarClock,
    lucideChevronRight,
    lucideEllipsis,
    lucideLayoutDashboard,
    lucideLink,
    lucideLogOut,
    lucideMoon,
    lucidePackage,
    lucideReceiptEuro,
    lucideSettings,
    lucideShieldCheck,
    lucideSun,
    lucideUsers,
} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {filter} from 'rxjs';
import {Auth} from '../core/auth';
import {ThemeService} from '../core/theme';

interface NavItem {
    path: string;
    label: string;
    /** Libellé court pour la barre d'onglets mobile */
    short?: string;
    icon: string;
}

@Component({
    selector: 'app-shell',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIcon, HlmButtonImports],
    providers: [
        provideIcons({
            lucideLayoutDashboard,
            lucideReceiptEuro,
            lucideCalendarClock,
            lucideChevronRight,
            lucideEllipsis,
            lucideLink,
            lucideBuilding2,
            lucideSettings,
            lucideShieldCheck,
            lucideLogOut,
            lucideMoon,
            lucidePackage,
            lucideSun,
            lucideUsers,
        }),
    ],
    template: `
        <div class="flex min-h-dvh">
            <!-- Barre latérale (tablette paysage / ordinateur) -->
            <aside
                class="bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r md:flex"
            >
                <div class="flex h-14 items-center gap-2 px-4">
                    <div
                        class="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs font-bold"
                    >
                        FH
                    </div>
                    <span class="font-semibold tracking-tight">Freelance Hub</span>
                </div>
                <nav class="flex flex-1 flex-col gap-0.5 px-2 py-2">
                    @for (item of nav; track item.path) {
                        <a
                            [routerLink]="item.path"
                            routerLinkActive="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            [routerLinkActiveOptions]="{exact: item.path === '/'}"
                            class="hover:bg-sidebar-accent/70 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
                        >
                            <ng-icon [name]="item.icon" class="text-base opacity-80" />
                            {{ item.label }}
                        </a>
                    }
                </nav>
                <div class="border-sidebar-border flex items-center gap-1 border-t p-2">
                    <button hlmBtn variant="ghost" size="sm" class="flex-1 justify-start" (click)="logout()">
                        <ng-icon name="lucideLogOut" />
                        Déconnexion
                    </button>
                    <button
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        (click)="theme.toggle()"
                        [attr.aria-label]="themeLabel()"
                    >
                        <ng-icon [name]="theme.theme() === 'dark' ? 'lucideSun' : 'lucideMoon'" />
                    </button>
                </div>
            </aside>

            <div class="flex min-w-0 flex-1 flex-col md:pl-60">
                <main
                    class="mx-auto w-full max-w-6xl flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(var(--tabbar-h)+5rem)] md:px-8 md:py-8"
                >
                    <router-outlet />
                </main>
            </div>

            <!-- Barre d'onglets mobile -->
            <nav
                class="bg-background/90 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
                aria-label="Navigation principale"
            >
                <div class="grid h-[3.25rem] grid-cols-5">
                    @for (item of tabs; track item.path) {
                        <a
                            [routerLink]="item.path"
                            routerLinkActive
                            #rla="routerLinkActive"
                            [routerLinkActiveOptions]="{exact: item.path === '/'}"
                            class="flex flex-col items-center justify-center gap-1 text-[10px] select-none"
                            [class]="
                                rla.isActive ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium'
                            "
                            [attr.aria-current]="rla.isActive ? 'page' : null"
                        >
                            <ng-icon
                                [name]="item.icon"
                                class="text-[1.375rem]"
                                [strokeWidth]="rla.isActive ? 2.25 : 1.75"
                            />
                            {{ item.short ?? item.label }}
                        </a>
                    }
                    <button
                        type="button"
                        class="flex flex-col items-center justify-center gap-1 text-[10px] select-none"
                        [class]="
                            moreActive() || moreOpen()
                                ? 'text-foreground font-semibold'
                                : 'text-muted-foreground font-medium'
                        "
                        (click)="moreOpen.set(true)"
                        aria-haspopup="dialog"
                    >
                        <ng-icon
                            name="lucideEllipsis"
                            class="text-[1.375rem]"
                            [strokeWidth]="moreActive() ? 2.25 : 1.75"
                        />
                        Plus
                    </button>
                </div>
            </nav>

            <!-- Feuille « Plus » -->
            @if (moreOpen()) {
                <div
                    class="animate-in fade-in-0 fixed inset-0 z-50 bg-black/40 duration-200 md:hidden"
                    (click)="moreOpen.set(false)"
                ></div>
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Plus"
                    class="bg-background animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 rounded-t-2xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] duration-300 ease-out md:hidden"
                    (keydown.escape)="moreOpen.set(false)"
                >
                    <div class="bg-muted-foreground/30 mx-auto mb-3 h-1 w-10 rounded-full"></div>
                    <ul class="bg-card divide-y overflow-hidden rounded-xl border">
                        @for (item of more; track item.path) {
                            <li>
                                <a [routerLink]="item.path" class="active:bg-muted flex items-center gap-3 px-4 py-3.5">
                                    <span class="bg-muted grid size-8 place-items-center rounded-lg"
                                        ><ng-icon [name]="item.icon"
                                    /></span>
                                    <span class="flex-1 font-medium">{{ item.label }}</span>
                                    <ng-icon name="lucideChevronRight" class="text-muted-foreground" />
                                </a>
                            </li>
                        }
                    </ul>
                    <ul class="bg-card mt-3 divide-y overflow-hidden rounded-xl border">
                        <li>
                            <button
                                type="button"
                                class="active:bg-muted flex w-full items-center gap-3 px-4 py-3.5 text-left"
                                (click)="theme.toggle()"
                            >
                                <span class="bg-muted grid size-8 place-items-center rounded-lg">
                                    <ng-icon [name]="theme.theme() === 'dark' ? 'lucideSun' : 'lucideMoon'" />
                                </span>
                                <span class="flex-1 font-medium">{{
                                    theme.theme() === 'dark' ? 'Thème clair' : 'Thème sombre'
                                }}</span>
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                class="text-destructive active:bg-muted flex w-full items-center gap-3 px-4 py-3.5 text-left"
                                (click)="logout()"
                            >
                                <span class="bg-destructive/10 grid size-8 place-items-center rounded-lg"
                                    ><ng-icon name="lucideLogOut"
                                /></span>
                                <span class="flex-1 font-medium">Déconnexion</span>
                            </button>
                        </li>
                    </ul>
                </div>
            }
        </div>
    `,
})
export class Shell {
    protected readonly theme = inject(ThemeService);
    private readonly auth = inject(Auth);
    private readonly router = inject(Router);

    protected readonly moreOpen = signal(false);
    private readonly url = signal(this.router.url);

    protected readonly nav: NavItem[] = [
        {path: '/', label: 'Tableau de bord', short: 'Accueil', icon: 'lucideLayoutDashboard'},
        {path: '/paiements', label: 'Paiements', icon: 'lucideReceiptEuro'},
        {path: '/clients', label: 'Clients', icon: 'lucideUsers'},
        {path: '/prestations', label: 'Prestations', icon: 'lucidePackage'},
        {path: '/echeances', label: 'Échéances', icon: 'lucideCalendarClock'},
        {path: '/plateformes', label: 'Plateformes', icon: 'lucideLink'},
        {path: '/entreprise', label: 'Entreprise', icon: 'lucideBuilding2'},
        {path: '/parametres', label: 'Paramètres', icon: 'lucideSettings'},
        {path: '/securite', label: 'Sécurité', icon: 'lucideShieldCheck'},
    ];

    /** Onglets principaux sur mobile ; le reste passe dans « Plus » */
    private readonly tabPaths = ['/', '/paiements', '/clients', '/echeances'];
    protected readonly tabs = this.tabPaths.map((p) => this.nav.find((n) => n.path === p)!);
    protected readonly more = this.nav.filter((n) => !this.tabPaths.includes(n.path));

    protected readonly moreActive = computed(() => {
        const path = this.url().split(/[?#]/)[0];
        return this.more.some((m) => path === m.path || path.startsWith(m.path + '/'));
    });

    protected readonly themeLabel = computed(() =>
        this.theme.theme() === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre',
    );

    constructor() {
        this.router.events
            .pipe(
                filter((e) => e instanceof NavigationEnd),
                takeUntilDestroyed(inject(DestroyRef)),
            )
            .subscribe((e) => {
                this.moreOpen.set(false);
                this.url.set(e.urlAfterRedirects);
            });
    }

    async logout() {
        this.moreOpen.set(false);
        await this.auth.logout();
        await this.router.navigateByUrl('/login');
    }
}
