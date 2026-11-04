import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBuilding2,
  lucideCalendarClock,
  lucideLayoutDashboard,
  lucideLink,
  lucideLogOut,
  lucideMenu,
  lucideMoon,
  lucidePackage,
  lucideReceiptEuro,
  lucideSettings,
  lucideSun,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { filter } from 'rxjs';
import { Auth } from '../core/auth';
import { ThemeService } from '../core/theme';

interface NavItem {
  path: string;
  label: string;
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
      lucideLink,
      lucideBuilding2,
      lucideSettings,
      lucideLogOut,
      lucideMoon,
      lucidePackage,
      lucideSun,
      lucideMenu,
      lucideUsers,
      lucideX,
    }),
  ],
  template: `
    <div class="flex min-h-dvh">
      <!-- Barre latérale -->
      <aside
        class="bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r transition-transform md:translate-x-0"
        [class.-translate-x-full]="!menuOpen()"
      >
        <div class="flex h-14 items-center gap-2 px-4">
          <div class="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs font-bold">
            FH
          </div>
          <span class="font-semibold tracking-tight">Freelance Hub</span>
          <button hlmBtn variant="ghost" size="icon-sm" class="ml-auto md:hidden" (click)="menuOpen.set(false)" aria-label="Fermer le menu">
            <ng-icon name="lucideX" />
          </button>
        </div>
        <nav class="flex flex-1 flex-col gap-0.5 px-2 py-2">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              [routerLinkActiveOptions]="{ exact: item.path === '/' }"
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
            [attr.aria-label]="theme.theme() === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'"
          >
            <ng-icon [name]="theme.theme() === 'dark' ? 'lucideSun' : 'lucideMoon'" />
          </button>
        </div>
      </aside>

      @if (menuOpen()) {
        <div class="fixed inset-0 z-30 bg-black/40 md:hidden" (click)="menuOpen.set(false)"></div>
      }

      <div class="flex min-w-0 flex-1 flex-col md:pl-60">
        <header class="bg-background/80 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4 backdrop-blur md:hidden">
          <button hlmBtn variant="ghost" size="icon-sm" (click)="menuOpen.set(true)" aria-label="Ouvrir le menu">
            <ng-icon name="lucideMenu" />
          </button>
          <span class="font-semibold">Freelance Hub</span>
        </header>
        <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/', label: 'Tableau de bord', icon: 'lucideLayoutDashboard' },
    { path: '/paiements', label: 'Paiements', icon: 'lucideReceiptEuro' },
    { path: '/clients', label: 'Clients', icon: 'lucideUsers' },
    { path: '/prestations', label: 'Prestations', icon: 'lucidePackage' },
    { path: '/echeances', label: 'Échéances', icon: 'lucideCalendarClock' },
    { path: '/plateformes', label: 'Plateformes', icon: 'lucideLink' },
    { path: '/entreprise', label: 'Entreprise', icon: 'lucideBuilding2' },
    { path: '/parametres', label: 'Paramètres', icon: 'lucideSettings' },
  ];

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.menuOpen.set(false));
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
