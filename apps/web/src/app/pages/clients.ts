import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {
    lucideEllipsis,
    lucideFilePlus,
    lucideImport,
    lucidePencil,
    lucidePlus,
    lucideSearch,
    lucideTrash2,
} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {HlmTableImports} from '@spartan-ng/helm/table';
import {Api, errorMessage} from '../core/api';
import {EurPipe, FrDatePipe} from '../core/format';
import type {Client, Payment} from '../core/models';
import {ClientDialog, emptyClient, type ClientDialogContext} from './client-dialog';
import {InvoiceDialog, type InvoiceDialogContext} from './invoice-dialog';

interface ClientStats {
    count: number;
    total: number;
    last: string | null;
}

@Component({
    selector: 'app-clients',
    imports: [
        FormsModule,
        NgIcon,
        EurPipe,
        FrDatePipe,
        HlmButtonImports,
        HlmCardImports,
        HlmDropdownMenuImports,
        HlmInputImports,
        HlmSkeletonImports,
        HlmTableImports,
    ],
    providers: [
        provideIcons({
            lucidePlus,
            lucidePencil,
            lucideTrash2,
            lucideEllipsis,
            lucideFilePlus,
            lucideImport,
            lucideSearch,
        }),
    ],
    template: `
        <div class="page-head">
            <div>
                <h1>Clients</h1>
                <p class="text-muted-foreground text-sm">Coordonnées réutilisées à chaque facture</p>
            </div>
            <button hlmBtn class="fab" (click)="edit()" aria-label="Nouveau client">
                <ng-icon name="lucidePlus" /><span class="fab-label">Nouveau client</span>
            </button>
        </div>

        @if (clients(); as list) {
            @if (orphans().length) {
                <div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 text-sm">
                    <span class="flex-1">
                        {{ orphans().length }} client(s) de tes paiements ne sont pas encore dans le carnet :
                        <span class="text-muted-foreground">{{ orphans().join(', ') }}</span>
                    </span>
                    <button hlmBtn variant="outline" size="sm" [disabled]="importing()" (click)="importOrphans()">
                        <ng-icon name="lucideImport" /> Importer
                    </button>
                </div>
            }

            @if (list.length === 0) {
                <section hlmCard class="items-center py-12 text-center">
                    <p class="text-muted-foreground text-sm">Aucun client enregistré.</p>
                    <button hlmBtn variant="outline" (click)="edit()">
                        <ng-icon name="lucidePlus" /> Ajouter le premier
                    </button>
                </section>
            } @else {
                <div class="relative mb-4 sm:max-w-sm">
                    <ng-icon
                        name="lucideSearch"
                        class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
                    />
                    <input
                        hlmInput
                        class="pl-8"
                        placeholder="Rechercher un client"
                        aria-label="Rechercher"
                        [ngModel]="query()"
                        (ngModelChange)="query.set($event)"
                    />
                </div>
                <!-- Mobile : liste -->
                <ul class="bg-card divide-y overflow-hidden rounded-xl border sm:hidden">
                    @for (c of filtered(); track c.id) {
                        @let s = stats().get(c.id);
                        <li class="tap-row flex items-center gap-3 py-3 pr-1 pl-4" (click)="edit(c)">
                            <span
                                class="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold"
                                >{{ initials(c.name) }}</span
                            >
                            <div class="min-w-0 flex-1">
                                <p class="truncate font-medium">{{ c.name }}</p>
                                <p class="text-muted-foreground truncate text-xs">
                                    {{ s?.count ?? 0 }} facture{{ (s?.count ?? 0) > 1 ? 's' : ''
                                    }}{{ s?.last ? ' · ' + (s!.last | frDate: 'short') : '' }}
                                </p>
                            </div>
                            <span class="shrink-0 text-sm font-medium tabular-nums">{{
                                s ? (s.total | eur) : '—'
                            }}</span>
                            <button
                                hlmBtn
                                variant="ghost"
                                size="icon"
                                class="text-muted-foreground shrink-0"
                                [hlmDropdownMenuTrigger]="menu"
                                [hlmDropdownMenuTriggerData]="{$implicit: c}"
                                align="end"
                                aria-label="Actions"
                                (click)="$event.stopPropagation()"
                            >
                                <ng-icon name="lucideEllipsis" />
                            </button>
                        </li>
                    } @empty {
                        <li class="text-muted-foreground px-4 py-8 text-center text-sm">
                            Aucun client ne correspond à la recherche.
                        </li>
                    }
                </ul>

                <div hlmTableContainer class="hidden overflow-hidden rounded-xl border sm:block">
                    <table
                        hlmTable
                        class="[&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_tr>*:first-child]:pl-5 [&_tr>*:last-child]:pr-4"
                    >
                        <thead hlmTHead class="bg-muted/40">
                            <tr hlmTr>
                                <th hlmTh>Client</th>
                                <th hlmTh class="hidden md:table-cell">Pays</th>
                                <th hlmTh class="hidden lg:table-cell">N° TVA</th>
                                <th hlmTh class="text-right">Factures</th>
                                <th hlmTh class="text-right">Facturé</th>
                                <th hlmTh class="hidden md:table-cell">Dernière</th>
                                <th hlmTh class="w-10"><span class="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody hlmTBody>
                            @for (c of filtered(); track c.id) {
                                @let s = stats().get(c.id);
                                <tr hlmTr class="cursor-pointer" (click)="edit(c)">
                                    <td hlmTd class="max-w-64">
                                        <p class="truncate font-medium">{{ c.name }}</p>
                                        @if (c.email) {
                                            <p class="text-muted-foreground truncate text-xs">{{ c.email }}</p>
                                        }
                                    </td>
                                    <td hlmTd class="hidden whitespace-nowrap md:table-cell">{{ c.country || '—' }}</td>
                                    <td hlmTd class="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                                        {{ c.vatNumber || '—' }}
                                    </td>
                                    <td hlmTd class="text-right tabular-nums">{{ s?.count ?? 0 }}</td>
                                    <td hlmTd class="text-right font-medium whitespace-nowrap tabular-nums">
                                        {{ s ? (s.total | eur) : '—' }}
                                    </td>
                                    <td hlmTd class="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                                        {{ s?.last ? (s!.last | frDate: 'short') : '—' }}
                                    </td>
                                    <td hlmTd (click)="$event.stopPropagation()">
                                        <button
                                            hlmBtn
                                            variant="ghost"
                                            size="icon-sm"
                                            [hlmDropdownMenuTrigger]="menu"
                                            [hlmDropdownMenuTriggerData]="{$implicit: c}"
                                            align="end"
                                            aria-label="Actions"
                                        >
                                            <ng-icon name="lucideEllipsis" />
                                        </button>
                                    </td>
                                </tr>
                            } @empty {
                                <tr hlmTr>
                                    <td hlmTd colspan="7" class="text-muted-foreground py-8 text-center">
                                        Aucun client ne correspond à la recherche.
                                    </td>
                                </tr>
                            }
                        </tbody>
                    </table>
                </div>
            }
        } @else if (error()) {
            <p class="text-destructive text-sm">{{ error() }}</p>
        } @else {
            <hlm-skeleton class="block h-64 rounded-xl" />
        }

        <ng-template #menu let-c>
            <hlm-dropdown-menu class="w-48">
                <button hlmDropdownMenuItem (click)="invoice(c)">
                    <ng-icon name="lucideFilePlus" /> Nouvelle facture
                </button>
                <button hlmDropdownMenuItem (click)="edit(c)"><ng-icon name="lucidePencil" /> Modifier</button>
                <hlm-dropdown-menu-separator />
                <button hlmDropdownMenuItem variant="destructive" (click)="remove(c)">
                    <ng-icon name="lucideTrash2" /> Supprimer
                </button>
            </hlm-dropdown-menu>
        </ng-template>
    `,
})
export class ClientsPage {
    private readonly api = inject(Api);
    private readonly dialog = inject(HlmDialogService);

    protected readonly clients = signal<Client[] | null>(null);
    protected readonly payments = signal<Payment[]>([]);
    protected readonly error = signal('');
    protected readonly query = signal('');
    protected readonly importing = signal(false);

    protected readonly filtered = computed(() => {
        const q = this.query().trim().toLowerCase();
        return (this.clients() ?? []).filter(
            (c) => !q || [c.name, c.country, c.vatNumber, c.email].some((v) => v.toLowerCase().includes(q)),
        );
    });

    /** Facturé par client (paiements rattachés au carnet ou portant le même nom) */
    protected readonly stats = computed(() => {
        const list = this.clients() ?? [];
        const byName = new Map(list.map((c) => [c.name.toLowerCase(), c.id]));
        const map = new Map<string, ClientStats>();
        for (const p of this.payments()) {
            const id = p.clientId ?? byName.get(p.client.toLowerCase());
            if (!id) continue;
            const s = map.get(id) ?? {count: 0, total: 0, last: null};
            s.count++;
            s.total += p.amount;
            if (!s.last || p.issuedOn > s.last) s.last = p.issuedOn;
            map.set(id, s);
        }
        return map;
    });

    /** Noms de clients présents dans les paiements mais absents du carnet */
    protected readonly orphans = computed(() => {
        const list = this.clients();
        if (!list) return [];
        const ids = new Set(list.map((c) => c.id));
        const names = new Set(list.map((c) => c.name.toLowerCase()));
        const out = new Map<string, string>();
        for (const p of this.payments()) {
            if ((p.clientId && ids.has(p.clientId)) || names.has(p.client.toLowerCase())) continue;
            out.set(p.client.toLowerCase(), p.client);
        }
        return [...out.values()].sort((a, b) => a.localeCompare(b, 'fr'));
    });

    constructor() {
        void this.load();
    }

    async load() {
        try {
            const [clients, payments] = await Promise.all([this.api.clients(), this.api.payments()]);
            this.payments.set(payments);
            this.clients.set(clients);
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    edit(client?: Client) {
        const ref = this.dialog.open<Client | undefined, ClientDialogContext>(ClientDialog, {
            context: {client},
            contentClass: 'sm:max-w-2xl',
            closeLabel: 'Fermer',
        });
        ref.closed$.subscribe((saved) => {
            if (saved) void this.load();
        });
    }

    invoice(client: Client) {
        const ref = this.dialog.open<boolean, InvoiceDialogContext>(InvoiceDialog, {
            context: {clientId: client.id, clients: this.clients() ?? [], payments: this.payments()},
            contentClass: 'sm:max-w-3xl',
            closeLabel: 'Fermer',
        });
        ref.closed$.subscribe((changed) => {
            if (changed) void this.load();
        });
    }

    async importOrphans() {
        this.importing.set(true);
        try {
            for (const name of this.orphans()) await this.api.createClient({...emptyClient(), name});
            toast.success('Clients importés : complète leurs coordonnées avant de facturer');
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.importing.set(false);
        }
    }

    async remove(c: Client) {
        const n = this.stats().get(c.id)?.count ?? 0;
        const extra = n ? ` Ses ${n} facture(s) existante(s) restent intactes.` : '';
        if (!confirm(`Supprimer ${c.name} du carnet ?${extra}`)) return;
        try {
            await this.api.deleteClient(c.id);
            toast.success('Client supprimé');
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }

    protected initials(name: string) {
        const words = name.trim().split(/\s+/).filter(Boolean);
        return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
    }
}
