import {Component, computed, inject, signal} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideArrowDown, lucideArrowUp, lucidePencil, lucidePlus, lucideTrash2} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {errorMessage} from '../../core/http/error-message';
import {EmptyState} from '../../shared/ui/empty-state/empty-state';
import {PageHeader} from '../../shared/ui/page-header/page-header';
import {PlatformCard} from './platform-card/platform-card';
import {openPlatformDialog} from './platform-dialog/platform-dialog';
import type {Platform} from './platform.models';
import {PlatformsApi} from './platforms.api';

@Component({
    selector: 'app-platforms',
    imports: [
        NgIcon,
        HlmButtonImports,
        HlmDropdownMenuImports,
        HlmSkeletonImports,
        EmptyState,
        PageHeader,
        PlatformCard,
    ],
    providers: [provideIcons({lucidePlus, lucidePencil, lucideTrash2, lucideArrowUp, lucideArrowDown})],
    templateUrl: './platforms.page.html',
})
export class PlatformsPage {
    private readonly api = inject(PlatformsApi);
    private readonly dialog = inject(HlmDialogService);

    protected readonly platforms = signal<Platform[] | null>(null);
    protected readonly error = signal('');

    protected readonly groups = computed(() => {
        const list = this.platforms();
        if (!list) return null;
        const map = new Map<string, Platform[]>();
        for (const p of list) map.set(p.category || 'Autre', [...(map.get(p.category || 'Autre') ?? []), p]);
        return [...map.entries()].map(([category, items]) => ({category, items}));
    });

    constructor() {
        void this.load();
    }

    async load() {
        try {
            this.platforms.set(await this.api.list());
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    open(platform?: Platform) {
        const categories = [...new Set((this.platforms() ?? []).map((p) => p.category))];
        openPlatformDialog(this.dialog, {platform, categories}).subscribe((changed) => {
            if (changed) void this.load();
        });
    }

    /** Platforms only move within their category */
    private siblings(p: Platform) {
        return (this.platforms() ?? []).filter((x) => x.category === p.category);
    }
    isFirst(p: Platform) {
        return this.siblings(p)[0]?.id === p.id;
    }
    isLast(p: Platform) {
        return this.siblings(p).at(-1)?.id === p.id;
    }

    async move(p: Platform, dir: -1 | 1) {
        const list = [...(this.platforms() ?? [])];
        const sib = this.siblings(p);
        const target = sib[sib.findIndex((x) => x.id === p.id) + dir];
        if (!target) return;
        const i = list.findIndex((x) => x.id === p.id);
        const j = list.findIndex((x) => x.id === target.id);
        [list[i], list[j]] = [list[j], list[i]];
        this.platforms.set(list);
        try {
            this.platforms.set(await this.api.reorder(list.map((x) => x.id)));
        } catch (err) {
            toast.error(errorMessage(err));
            await this.load();
        }
    }

    async remove(p: Platform) {
        if (!confirm(`Supprimer « ${p.name} » ?`)) return;
        try {
            await this.api.delete(p.id);
            toast.success('Plateforme supprimée');
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }
}
