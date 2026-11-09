import {Component, computed, inject, signal} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideEllipsis, lucidePencil, lucidePlus, lucideTrash2} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmDropdownMenuImports} from '@spartan-ng/helm/dropdown-menu';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {HlmTableImports} from '@spartan-ng/helm/table';
import {errorMessage} from '../../core/http/error-message';
import {EurPipe} from '../../shared/pipes/eur.pipe';
import {Avatar} from '../../shared/ui/avatar/avatar';
import {EmptyState} from '../../shared/ui/empty-state/empty-state';
import {ListRow} from '../../shared/ui/list-row/list-row';
import {PageHeader} from '../../shared/ui/page-header/page-header';
import {SearchInput} from '../../shared/ui/search-input/search-input';
import type {Client} from '../clients/client.models';
import {ClientsApi} from '../clients/clients.api';
import {openServiceDetail} from './service-detail/service-detail';
import {openServiceDialog} from './service-dialog/service-dialog';
import type {Service} from './service.models';
import {ServicesApi} from './services.api';

@Component({
    selector: 'app-services',
    imports: [
        NgIcon,
        EurPipe,
        HlmButtonImports,
        HlmDropdownMenuImports,
        HlmSkeletonImports,
        HlmTableImports,
        Avatar,
        EmptyState,
        ListRow,
        PageHeader,
        SearchInput,
    ],
    providers: [provideIcons({lucidePlus, lucidePencil, lucideTrash2, lucideEllipsis})],
    templateUrl: './services.page.html',
})
export class ServicesPage {
    private readonly servicesApi = inject(ServicesApi);
    private readonly clientsApi = inject(ClientsApi);
    private readonly dialog = inject(HlmDialogService);

    protected readonly services = signal<Service[] | null>(null);
    protected readonly clients = signal<Client[]>([]);
    protected readonly error = signal('');
    protected readonly query = signal('');

    protected readonly filtered = computed(() => {
        const q = this.query().trim().toLowerCase();
        return (this.services() ?? []).filter(
            (s) => !q || [s.label, s.labelEn, s.detail, s.unit].some((v) => v.toLowerCase().includes(q)),
        );
    });

    constructor() {
        void this.load();
    }

    async load() {
        try {
            const [services, clients] = await Promise.all([this.servicesApi.list(), this.clientsApi.list()]);
            this.clients.set(clients);
            this.services.set(services);
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    /** Service card; its buttons lead to the form or the deletion */
    detail(service: Service) {
        openServiceDetail(this.dialog, {service, clientName: this.clientLabel(service.clientId)}).subscribe(
            (action) => {
                if (action === 'edit') this.edit(service);
                else if (action === 'delete') void this.remove(service);
            },
        );
    }

    edit(service?: Service) {
        openServiceDialog(this.dialog, {service, clients: this.clients()}).subscribe((saved) => {
            if (saved) void this.load();
        });
    }

    /** Avatar name: null shows the "all clients" avatar */
    protected clientLabel(id: string | null): string | null {
        return id ? this.clientName(id) : null;
    }

    protected clientName(id: string | null) {
        if (!id) return 'Tous les clients';
        return this.clients().find((c) => c.id === id)?.name ?? 'Client supprimé';
    }

    async remove(s: Service) {
        if (!confirm(`Supprimer la prestation « ${s.label} » ? Les factures déjà émises ne sont pas modifiées.`))
            return;
        try {
            await this.servicesApi.delete(s.id);
            toast.success('Prestation supprimée');
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }
}
