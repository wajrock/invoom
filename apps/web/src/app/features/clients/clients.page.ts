import {Component, computed, inject, signal} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideEllipsis, lucideFilePlus, lucideImport, lucidePencil, lucidePlus, lucideTrash2} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {HlmTableImports} from '@spartan-ng/helm/table';
import {errorMessage} from '../../core/http/error-message';
import {EurPipe} from '../../shared/pipes/eur.pipe';
import {FrDatePipe} from '../../shared/pipes/fr-date.pipe';
import {EmptyState} from '../../shared/ui/empty-state/empty-state';
import {ListRow} from '../../shared/ui/list-row/list-row';
import {PageHeader} from '../../shared/ui/page-header/page-header';
import {SearchInput} from '../../shared/ui/search-input/search-input';
import {openInvoiceDialog} from '../invoices/invoice-dialog/invoice-dialog';
import type {Payment} from '../payments/payment.models';
import {PaymentsApi} from '../payments/payments.api';
import {openClientDialog} from './client-dialog/client-dialog';
import {emptyClient, type Client} from './client.models';
import {ClientsApi} from './clients.api';

interface ClientStats {
    count: number;
    total: number;
    last: string | null;
}

@Component({
    selector: 'app-clients',
    imports: [
        NgIcon,
        EurPipe,
        FrDatePipe,
        HlmButtonImports,
        HlmDropdownMenuImports,
        HlmSkeletonImports,
        HlmTableImports,
        EmptyState,
        ListRow,
        PageHeader,
        SearchInput,
    ],
    providers: [provideIcons({lucidePlus, lucidePencil, lucideTrash2, lucideEllipsis, lucideFilePlus, lucideImport})],
    templateUrl: './clients.page.html',
})
export class ClientsPage {
    private readonly clientsApi = inject(ClientsApi);
    private readonly paymentsApi = inject(PaymentsApi);
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

    /** Invoiced per client (payments linked to the client, or carrying the same name) */
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

    /** Client names found in payments but missing from the address book */
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
            const [clients, payments] = await Promise.all([this.clientsApi.list(), this.paymentsApi.list()]);
            this.payments.set(payments);
            this.clients.set(clients);
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    edit(client?: Client) {
        openClientDialog(this.dialog, {client}).subscribe((saved) => {
            if (saved) void this.load();
        });
    }

    invoice(client: Client) {
        openInvoiceDialog(this.dialog, {
            clientId: client.id,
            clients: this.clients() ?? [],
            payments: this.payments(),
        }).subscribe((changed) => {
            if (changed) void this.load();
        });
    }

    async importOrphans() {
        this.importing.set(true);
        try {
            for (const name of this.orphans()) await this.clientsApi.create({...emptyClient(), name});
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
            await this.clientsApi.delete(c.id);
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
