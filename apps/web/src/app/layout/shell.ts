import {Component, computed, DestroyRef, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {filter} from 'rxjs';
import {Auth} from '../core/auth/auth.service';
import {MoreSheet} from './more-sheet';
import {MORE_GROUPS} from './nav';
import {Sidebar} from './sidebar';
import {TabBar} from './tab-bar';

/** Authenticated layout: sidebar on desktop, tab bar and "Plus" sheet on mobile. */
@Component({
    selector: 'app-shell',
    imports: [RouterOutlet, Sidebar, TabBar, MoreSheet],
    template: `
        <div class="flex min-h-dvh">
            <app-sidebar (logout)="logout()" />

            <div class="flex min-w-0 flex-1 flex-col md:pl-60">
                <main
                    class="mx-auto w-full max-w-6xl flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(var(--tabbar-h)+5rem)] md:px-8 md:py-8"
                >
                    <router-outlet />
                </main>
            </div>

            <app-tab-bar [moreActive]="moreActive()" [moreOpen]="moreOpen()" (openMore)="moreOpen.set(true)" />

            @if (moreOpen()) {
                <app-more-sheet (closed)="moreOpen.set(false)" (logout)="logout()" />
            }
        </div>
    `,
})
export class Shell {
    private readonly auth = inject(Auth);
    private readonly router = inject(Router);

    protected readonly moreOpen = signal(false);
    private readonly url = signal(this.router.url);

    protected readonly moreActive = computed(() => {
        const path = this.url().split(/[?#]/)[0];
        return MORE_GROUPS.flatMap((g) => g.items).some((m) => path === m.path || path.startsWith(m.path + '/'));
    });

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
