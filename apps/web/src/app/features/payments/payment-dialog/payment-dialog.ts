import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmDialogImports, type HlmDialogService} from '@spartan-ng/helm/dialog';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {HlmTextareaImports} from '@spartan-ng/helm/textarea';
import {errorMessage} from '../../../core/http/error-message';
import {DateInput} from '../../../shared/ui/date-input/date-input';
import {DialogFooter} from '../../../shared/ui/dialog-footer/dialog-footer';
import {drawerOptions} from '../../../shared/ui/drawer/drawer';
import {todayIso} from '../../../shared/utils/dates';
import {centsToInput, CURRENCIES, parseEuros} from '../../../shared/utils/money';
import type {Client} from '../../clients/client.models';
import type {InvoiceFile, Payment, PaymentInput} from '../payment.models';
import {PaymentsApi} from '../payments.api';
import {PaymentFiles, type PendingFile} from './payment-files';

export interface PaymentDialogContext {
    payment?: Payment;
    /** Address book */
    clients: Client[];
    /** Client names already used in payments (suggestions) */
    names: string[];
}

/** Opens the payment form in a right drawer; emits true when the payments need reloading. */
export function openPaymentDialog(dialog: HlmDialogService, context: PaymentDialogContext) {
    return dialog.open<boolean, PaymentDialogContext>(PaymentDialog, drawerOptions(context)).closed$;
}

@Component({
    selector: 'app-payment-dialog',
    imports: [
        FormsModule,
        DateInput,
        HlmDialogImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSwitchImports,
        HlmTextareaImports,
        DialogFooter,
        PaymentFiles,
    ],
    host: {class: 'contents'},
    templateUrl: './payment-dialog.html',
})
export class PaymentDialog {
    private readonly api = inject(PaymentsApi);
    protected readonly ref = inject<BrnDialogRef<boolean>>(BrnDialogRef);
    private readonly ctx = injectBrnDialogContext<PaymentDialogContext>();

    protected readonly existing = this.ctx.payment;
    protected readonly invoice = this.existing?.invoice ?? null;
    /** Address book names first, then names typed in older payments */
    protected readonly suggestions = [...new Set([...this.ctx.clients.map((c) => c.name), ...this.ctx.names])];
    protected readonly currencies = CURRENCIES;

    protected readonly form = {
        client: this.existing?.client ?? '',
        label: this.existing?.label ?? '',
        invoiceNumber: this.existing?.invoiceNumber ?? '',
        issuedOn: this.existing?.issuedOn ?? todayIso(),
        paidOn: this.existing?.paidOn ?? todayIso(),
        amount: centsToInput(this.existing?.amount),
        originalAmount: centsToInput(this.existing?.originalAmount),
        notes: this.existing?.notes ?? '',
    };
    /** Invoice currency: in euros a single amount, otherwise the invoiced amount plus the euros received */
    protected readonly currency = signal(this.existing?.originalCurrency ?? 'EUR');
    protected readonly foreign = computed(() => this.currency() !== 'EUR');
    protected readonly paid = signal(this.existing ? this.existing.paidOn !== null : true);
    protected readonly files = signal<InvoiceFile[]>(this.existing?.files ?? []);
    protected readonly pending = signal<PendingFile[]>([]);
    protected readonly saving = signal(false);
    /** A file was deleted: the list must be reloaded even if the dialog is cancelled */
    protected changed = false;

    /** Picking a known client applies its invoicing currency (new payments only). */
    pickClient(name: string) {
        if (this.existing) return;
        const client = this.findClient(name);
        if (client) this.currency.set(client.currency);
    }

    private findClient(name: string) {
        const n = name.trim().toLowerCase();
        return this.ctx.clients.find((c) => c.name.toLowerCase() === n);
    }

    togglePaid(v: boolean) {
        this.paid.set(v);
        if (v && !this.form.paidOn) this.form.paidOn = todayIso();
    }

    async save() {
        const amount = parseEuros(this.form.amount);
        if (!this.form.client.trim()) return void toast.error('Le client est requis');
        const foreign = this.foreign();
        const originalAmount = foreign ? parseEuros(this.form.originalAmount) : null;
        // Older payments may have a currency without the invoiced amount: left empty, it stays unknown
        if (foreign && this.form.originalAmount.trim() && originalAmount === null)
            return void toast.error('Montant facturé invalide');
        if (amount === null) return void toast.error(foreign ? 'Montant reçu en euros invalide' : 'Montant invalide');

        const name = this.form.client.trim();
        // Link to the address book: the invoice's client, otherwise a client with the same name
        const match = this.findClient(name);
        const body: PaymentInput = {
            clientId: this.invoice ? this.invoice.clientId : (match?.id ?? null),
            client: name,
            label: this.form.label.trim(),
            invoiceNumber: this.form.invoiceNumber.trim(),
            issuedOn: this.form.issuedOn,
            paidOn: this.paid() ? this.form.paidOn : null,
            amount,
            originalAmount,
            originalCurrency: this.currency(),
            notes: this.form.notes,
        };

        this.saving.set(true);
        try {
            const saved = this.existing ? await this.api.update(this.existing.id, body) : await this.api.create(body);
            this.changed = true;

            const failures: string[] = [];
            for (const p of this.pending()) {
                try {
                    await this.api.uploadFile(saved.id, p.file, p.lang);
                } catch (err) {
                    failures.push(`${p.file.name} : ${errorMessage(err)}`);
                }
            }
            if (failures.length) toast.error(`Paiement enregistré, mais échec d'envoi : ${failures.join(' ; ')}`);
            else toast.success(this.existing ? 'Paiement mis à jour' : 'Paiement ajouté');
            this.ref.close(true);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
