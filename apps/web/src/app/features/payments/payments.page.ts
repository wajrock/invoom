import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideFilePlus, lucidePlus} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {errorMessage} from '../../core/http/error-message';
import {EurPipe} from '../../shared/pipes/eur.pipe';
import {EmptyState} from '../../shared/ui/empty-state/empty-state';
import {FilterBar} from '../../shared/ui/filter-bar/filter-bar';
import {KpiTile} from '../../shared/ui/kpi-tile/kpi-tile';
import {PageHeader} from '../../shared/ui/page-header/page-header';
import {todayIso} from '../../shared/utils/dates';
import type {Client} from '../clients/client.models';
import {ClientsApi} from '../clients/clients.api';
import {openInvoiceDialog} from '../invoices/invoice-dialog/invoice-dialog';
import {openPaymentDialog} from './payment-dialog/payment-dialog';
import {PaymentList} from './payment-list/payment-list';
import {paymentInput, type Payment, type PaymentAction} from './payment.models';
import {PaymentSheet} from './payment-sheet/payment-sheet';
import {PaymentsApi} from './payments.api';
import {PaymentsTable} from './payments-table/payments-table';

type StatusFilter = 'all' | 'paid' | 'pending';

/** Payment without an invoice generated here */
const MANUAL_HINT = 'Paiement sans facture générée ici : facture externe, acompte, historique…';

@Component({
    selector: 'app-payments',
    imports: [
        FormsModule,
        NgIcon,
        EurPipe,
        HlmButtonImports,
        HlmSkeletonImports,
        EmptyState,
        FilterBar,
        KpiTile,
        PageHeader,
        PaymentList,
        PaymentSheet,
        PaymentsTable,
    ],
    providers: [provideIcons({lucidePlus, lucideFilePlus})],
    templateUrl: './payments.page.html',
})
export class PaymentsPage {
    private readonly paymentsApi = inject(PaymentsApi);
    private readonly clientsApi = inject(ClientsApi);
    private readonly dialog = inject(HlmDialogService);

    protected readonly manualHint = MANUAL_HINT;
    protected readonly payments = signal<Payment[] | null>(null);
    protected readonly clientList = signal<Client[]>([]);
    protected readonly error = signal('');
    protected readonly query = signal('');
    protected readonly year = signal<string>(String(new Date().getFullYear()));
    protected readonly status = signal<StatusFilter>('all');
    /** Payment whose mobile action sheet is open */
    protected readonly sheet = signal<Payment | null>(null);

    protected readonly years = computed(() => {
        const ys = new Set<number>([new Date().getFullYear()]);
        for (const p of this.payments() ?? []) ys.add(Number((p.paidOn ?? p.issuedOn).slice(0, 4)));
        return [...ys].sort((a, b) => b - a);
    });

    /** Client names already used in payments */
    private readonly clientNames = computed(() =>
        [...new Set((this.payments() ?? []).map((p) => p.client))].sort((a, b) => a.localeCompare(b, 'fr')),
    );

    protected readonly filtered = computed(() => {
        const q = this.query().trim().toLowerCase();
        const y = this.year();
        const st = this.status();
        return (this.payments() ?? []).filter((p) => {
            // A payment counts in the year it was cashed (or issued, while pending)
            if (y !== 'all' && !(p.paidOn ?? p.issuedOn).startsWith(`${y}-`)) return false;
            if (st === 'paid' && !p.paidOn) return false;
            if (st === 'pending' && p.paidOn) return false;
            if (q && ![p.client, p.label, p.invoiceNumber, p.notes].some((v) => v.toLowerCase().includes(q)))
                return false;
            return true;
        });
    });

    protected readonly totals = computed(() => {
        let paid = 0;
        let pending = 0;
        for (const p of this.filtered()) {
            if (p.paidOn) paid += p.amount;
            else pending += p.amount;
        }
        return {paid, pending};
    });

    constructor() {
        void this.load();
    }

    async load() {
        try {
            const [payments, clients] = await Promise.all([this.paymentsApi.list(), this.clientsApi.list()]);
            this.clientList.set(clients);
            this.payments.set(payments);
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    run(p: Payment, action: PaymentAction) {
        this.sheet.set(null);
        if (action === 'paid') void this.markPaid(p);
        else if (action === 'invoice') this.openInvoice(p);
        else if (action === 'edit') this.open(p);
        else void this.remove(p);
    }

    open(payment?: Payment) {
        openPaymentDialog(this.dialog, {payment, clients: this.clientList(), names: this.clientNames()}).subscribe(
            (changed) => {
                if (changed) void this.load();
            },
        );
    }

    openInvoice(payment?: Payment) {
        openInvoiceDialog(this.dialog, {
            payment,
            clients: this.clientList(),
            payments: this.payments() ?? [],
        }).subscribe((changed) => {
            if (changed) void this.load();
        });
    }

    private async markPaid(p: Payment) {
        try {
            await this.paymentsApi.update(p.id, {...paymentInput(p), paidOn: todayIso()});
            toast.success('Paiement marqué comme encaissé');
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }

    private async remove(p: Payment) {
        const files = p.files.length ? ` et ses ${p.files.length} fichier(s)` : '';
        if (!confirm(`Supprimer le paiement de ${p.client}${files} ? Cette action est définitive.`)) return;
        try {
            await this.paymentsApi.delete(p.id);
            toast.success('Paiement supprimé');
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }
}
