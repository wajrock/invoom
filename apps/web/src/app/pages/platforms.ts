import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {
    lucideArrowDown,
    lucideArrowUp,
    lucideCopy,
    lucideEllipsis,
    lucideExternalLink,
    lucideGlobe,
    lucideLoader2,
    lucidePencil,
    lucidePlus,
    lucideTrash2,
} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmDialogImports, HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {Api, errorMessage} from '../core/api';
import {copyToClipboard} from '../core/format';
import type {Platform, PlatformInput} from '../core/models';

function hostOf(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

interface PlatformDialogContext {
    platform?: Platform;
    categories: string[];
}

@Component({
    selector: 'app-platform-dialog',
    imports: [FormsModule, NgIcon, HlmButtonImports, HlmDialogImports, HlmInputImports, HlmLabelImports],
    providers: [provideIcons({lucideLoader2})],
    host: {class: 'contents'},
    template: `
        <hlm-dialog-header>
            <h3 hlmDialogTitle>{{ existing ? 'Modifier la plateforme' : 'Nouvelle plateforme' }}</h3>
            <p hlmDialogDescription>Ne stocke jamais de mot de passe ici, uniquement l’identifiant.</p>
        </hlm-dialog-header>
        <form id="platform-form" class="grid gap-4" (ngSubmit)="save()">
            <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid gap-2">
                    <label hlmLabel for="pl-name">Nom</label>
                    <input hlmInput id="pl-name" name="name" required [(ngModel)]="form.name" />
                </div>
                <div class="grid gap-2">
                    <label hlmLabel for="pl-cat">Catégorie</label>
                    <input hlmInput id="pl-cat" name="category" list="pl-cats" [(ngModel)]="form.category" />
                    <datalist id="pl-cats">
                        @for (c of ctx.categories; track c) {
                            <option [value]="c"></option>
                        }
                    </datalist>
                </div>
            </div>
            <div class="grid gap-2">
                <label hlmLabel for="pl-url">Adresse</label>
                <input
                    hlmInput
                    id="pl-url"
                    name="url"
                    type="url"
                    required
                    placeholder="https://"
                    [(ngModel)]="form.url"
                />
            </div>
            <div class="grid gap-2">
                <label hlmLabel for="pl-desc">Description</label>
                <input hlmInput id="pl-desc" name="description" [(ngModel)]="form.description" />
            </div>
            <div class="grid gap-2">
                <label hlmLabel for="pl-login">Identifiant de connexion</label>
                <input
                    hlmInput
                    id="pl-login"
                    name="login"
                    autocomplete="off"
                    placeholder="e-mail, n° fiscal…"
                    [(ngModel)]="form.login"
                />
            </div>
        </form>
        <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" (click)="ref.close(false)">Annuler</button>
            <button hlmBtn type="submit" form="platform-form" [disabled]="saving()">
                @if (saving()) {
                    <ng-icon name="lucideLoader2" class="animate-spin" />
                }
                Enregistrer
            </button>
        </hlm-dialog-footer>
    `,
})
export class PlatformDialog {
    private readonly api = inject(Api);
    protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
    protected readonly ctx = injectBrnDialogContext<PlatformDialogContext>();
    protected readonly existing = this.ctx.platform;
    protected readonly saving = signal(false);
    protected readonly form: PlatformInput = {
        name: this.existing?.name ?? '',
        url: this.existing?.url ?? '',
        category: this.existing?.category ?? 'Autre',
        description: this.existing?.description ?? '',
        login: this.existing?.login ?? '',
    };

    async save() {
        let url = this.form.url.trim();
        if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
        if (!this.form.name.trim() || !hostOf(url)) return void toast.error('Nom et adresse valide requis');
        const body: PlatformInput = {
            ...this.form,
            url,
            name: this.form.name.trim(),
            category: this.form.category.trim() || 'Autre',
        };
        this.saving.set(true);
        try {
            if (this.existing) await this.api.updatePlatform(this.existing.id, body);
            else await this.api.createPlatform(body);
            toast.success(this.existing ? 'Plateforme mise à jour' : 'Plateforme ajoutée');
            this.ref.close(true);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

@Component({
    selector: 'app-platforms',
    imports: [NgIcon, HlmButtonImports, HlmCardImports, HlmDropdownMenuImports, HlmSkeletonImports],
    providers: [
        provideIcons({
            lucidePlus,
            lucideExternalLink,
            lucideCopy,
            lucidePencil,
            lucideTrash2,
            lucideEllipsis,
            lucideArrowUp,
            lucideArrowDown,
            lucideGlobe,
        }),
    ],
    template: `
        <div class="page-head">
            <div>
                <h1>Plateformes</h1>
                <p class="text-muted-foreground text-sm">Accès rapide aux sites administratifs et outils</p>
            </div>
            <button hlmBtn class="fab" (click)="open()" aria-label="Ajouter une plateforme">
                <ng-icon name="lucidePlus" /><span class="fab-label">Ajouter</span>
            </button>
        </div>

        @if (groups(); as gs) {
            <div class="grid gap-8">
                @for (g of gs; track g.category) {
                    <section>
                        <h2 class="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                            {{ g.category }}
                        </h2>
                        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            @for (p of g.items; track p.id) {
                                <div hlmCard class="hover:border-ring/60 group relative gap-0 py-0 transition-colors">
                                    <a
                                        [href]="p.url"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="flex items-start gap-3 p-4 pr-12"
                                    >
                                        <span
                                            class="bg-muted grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg"
                                        >
                                            @if (!broken().has(p.id) && host(p.url)) {
                                                <img
                                                    [src]="favicon(p.url)"
                                                    alt=""
                                                    width="20"
                                                    height="20"
                                                    loading="lazy"
                                                    referrerpolicy="no-referrer"
                                                    (error)="markBroken(p.id)"
                                                />
                                            } @else {
                                                <ng-icon name="lucideGlobe" class="text-muted-foreground" />
                                            }
                                        </span>
                                        <span class="min-w-0">
                                            <span class="flex items-center gap-1.5 font-medium">
                                                <span class="truncate">{{ p.name }}</span>
                                                <ng-icon
                                                    name="lucideExternalLink"
                                                    class="text-muted-foreground shrink-0 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                                                />
                                            </span>
                                            <span class="text-muted-foreground block truncate text-xs">{{
                                                host(p.url)
                                            }}</span>
                                            @if (p.description) {
                                                <span class="text-muted-foreground mt-1 line-clamp-2 block text-sm">{{
                                                    p.description
                                                }}</span>
                                            }
                                        </span>
                                    </a>
                                    @if (p.login) {
                                        <button
                                            class="bg-muted/50 hover:bg-muted flex items-center gap-2 border-t px-4 py-2 text-left text-xs transition-colors"
                                            (click)="copy(p.login)"
                                            title="Copier l’identifiant"
                                        >
                                            <ng-icon name="lucideCopy" class="text-muted-foreground shrink-0" />
                                            <span class="truncate font-mono">{{ p.login }}</span>
                                        </button>
                                    }
                                    <button
                                        hlmBtn
                                        variant="ghost"
                                        size="icon-sm"
                                        class="absolute top-3 right-3"
                                        [hlmDropdownMenuTrigger]="menu"
                                        [hlmDropdownMenuTriggerData]="{$implicit: p}"
                                        align="end"
                                        aria-label="Actions"
                                    >
                                        <ng-icon name="lucideEllipsis" />
                                    </button>
                                </div>
                            }
                        </div>
                    </section>
                } @empty {
                    <section hlmCard class="items-center py-12 text-center">
                        <p class="text-muted-foreground text-sm">Aucune plateforme.</p>
                    </section>
                }
            </div>
        } @else if (error()) {
            <p class="text-destructive text-sm">{{ error() }}</p>
        } @else {
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                    <hlm-skeleton class="h-24 rounded-xl" />
                }
            </div>
        }

        <ng-template #menu let-p>
            <hlm-dropdown-menu class="w-44">
                <button hlmDropdownMenuItem (click)="open(p)"><ng-icon name="lucidePencil" /> Modifier</button>
                <button hlmDropdownMenuItem [disabled]="isFirst(p)" (click)="move(p, -1)">
                    <ng-icon name="lucideArrowUp" /> Monter
                </button>
                <button hlmDropdownMenuItem [disabled]="isLast(p)" (click)="move(p, 1)">
                    <ng-icon name="lucideArrowDown" /> Descendre
                </button>
                <hlm-dropdown-menu-separator />
                <button hlmDropdownMenuItem variant="destructive" (click)="remove(p)">
                    <ng-icon name="lucideTrash2" /> Supprimer
                </button>
            </hlm-dropdown-menu>
        </ng-template>
    `,
})
export class PlatformsPage {
    private readonly api = inject(Api);
    private readonly dialog = inject(HlmDialogService);

    protected readonly platforms = signal<Platform[] | null>(null);
    protected readonly error = signal('');
    protected readonly broken = signal(new Set<string>());

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
            this.platforms.set(await this.api.platforms());
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    host(url: string) {
        return hostOf(url);
    }
    favicon(url: string) {
        return `https://icons.duckduckgo.com/ip3/${hostOf(url)}.ico`;
    }
    markBroken(id: string) {
        this.broken.update((s) => new Set(s).add(id));
    }
    copy(text: string) {
        void copyToClipboard(text, 'Identifiant copié');
    }

    open(platform?: Platform) {
        const categories = [...new Set((this.platforms() ?? []).map((p) => p.category))];
        const ref = this.dialog.open<boolean>(PlatformDialog, {
            context: {platform, categories} satisfies PlatformDialogContext,
            contentClass: 'sm:max-w-lg',
            closeLabel: 'Fermer',
        });
        ref.closed$.subscribe((changed) => {
            if (changed) void this.load();
        });
    }

    /** Les déplacements se font au sein de la même catégorie */
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
            this.platforms.set(await this.api.reorderPlatforms(list.map((x) => x.id)));
        } catch (err) {
            toast.error(errorMessage(err));
            await this.load();
        }
    }

    async remove(p: Platform) {
        if (!confirm(`Supprimer « ${p.name} » ?`)) return;
        try {
            await this.api.deletePlatform(p.id);
            toast.success('Plateforme supprimée');
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }
}
