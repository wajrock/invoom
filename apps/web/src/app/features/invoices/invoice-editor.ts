import {inject, Injectable, signal} from '@angular/core';
import {addDays, todayIso} from '../../shared/utils/dates';
import {centsToInput} from '../../shared/utils/money';
import type {Client} from '../clients/client.models';
import {VAT_MENTIONS, vatRegime, withVatMention, type VatRegime} from '../clients/countries';
import {CompanyApi} from '../company/company.api';
import type {Payment} from '../payments/payment.models';
import type {Service} from '../services/service.models';
import {ServicesApi} from '../services/services.api';
import {emptyLine, invoiceTotals, lineToForm, vatRateToInput, type InvoiceForm, type LineForm} from './invoice-form';
import type {InvoiceSettings, StoredInvoice} from './invoice.models';
import {InvoicesApi} from './invoices.api';

export interface InvoiceDialogContext {
    /** Payment the invoice belongs to (a new payment is created otherwise) */
    payment?: Payment;
    /** Client preselected for a new invoice */
    clientId?: string;
    clients: Client[];
    /** All payments: used to copy the lines of the client's last invoice */
    payments: Payment[];
}

/** Company fields an invoice cannot do without */
const REQUIRED_COMPANY = [
    ['name', 'nom'],
    ['address', 'adresse'],
    ['siret', 'SIRET'],
    ['iban', 'IBAN'],
] as const;

const byLabel = (a: {label: string}, b: {label: string}) => a.label.localeCompare(b.label, 'fr');

/** State of the invoice being edited, shared by the dialog sections. */
@Injectable()
export class InvoiceEditor {
    private readonly invoicesApi = inject(InvoicesApi);
    private readonly companyApi = inject(CompanyApi);
    private readonly servicesApi = inject(ServicesApi);

    private ctx!: InvoiceDialogContext;
    /** Invoice already generated for the payment */
    stored: StoredInvoice | null = null;

    readonly ready = signal(false);
    readonly clients = signal<Client[]>([]);
    /** Service catalog */
    readonly services = signal<Service[]>([]);
    readonly lines = signal<LineForm[]>([emptyLine()]);
    readonly missingCompany = signal<string[]>([]);
    /** Save the terms and payment delay as defaults for the next invoices */
    readonly saveDefaults = signal(false);

    readonly form: InvoiceForm = {
        clientId: '',
        number: '',
        issuedOn: todayIso(),
        dueOn: todayIso(),
        periodFrom: '',
        periodTo: '',
        currency: 'EUR',
        vatRate: '0',
        english: false,
        termsFr: '',
        termsEn: '',
        eurAmount: '',
    };
    /** Edited by hand: no longer derived from the issue date */
    numberTouched = false;
    dueTouched = false;
    private settings: InvoiceSettings = {paymentDays: 7, termsFr: '', termsEn: ''};

    async init(ctx: InvoiceDialogContext) {
        this.ctx = ctx;
        this.stored = ctx.payment?.invoice ?? null;
        this.clients.set(ctx.clients);
        const [settings, company, services] = await Promise.all([
            this.invoicesApi.settings(),
            this.companyApi.get(),
            this.servicesApi.list(),
        ]);
        this.services.set(services);
        this.settings = settings;
        this.missingCompany.set(
            REQUIRED_COMPANY.filter(([id]) => !company.fields.find((f) => f.id === id)?.value.trim()).map(
                ([, label]) => label,
            ),
        );

        const s = this.stored;
        const p = ctx.payment;
        if (s) {
            // Already generated: reload exactly what was entered
            Object.assign(this.form, {
                clientId: s.clientId,
                number: s.number,
                issuedOn: s.issuedOn,
                dueOn: s.dueOn,
                periodFrom: s.periodFrom ?? '',
                periodTo: s.periodTo ?? '',
                currency: s.currency,
                vatRate: vatRateToInput(s.vatRate),
                english: s.english,
                termsFr: s.termsFr,
                termsEn: s.termsEn,
                eurAmount: s.currency !== 'EUR' ? centsToInput(p!.amount) : '',
            });
            this.lines.set(s.lines.map(lineToForm));
            this.numberTouched = this.dueTouched = true;
        } else {
            this.form.termsFr = settings.termsFr;
            this.form.termsEn = settings.termsEn;
            if (p) this.prefillFromPayment(p);
            else if (ctx.clientId) {
                const client = this.clients().find((c) => c.id === ctx.clientId);
                if (client) this.applyClient(client, true);
            }
            this.form.dueOn = addDays(this.form.issuedOn, settings.paymentDays);
            if (!this.numberTouched) await this.suggestNumber();
        }
        this.ready.set(true);
    }

    /** Payment entered by hand: start from its details */
    private prefillFromPayment(p: Payment) {
        const client = this.clients().find(
            (c) => c.id === p.clientId || c.name.toLowerCase() === p.client.toLowerCase(),
        );
        if (client) this.applyClient(client, false);
        this.form.issuedOn = p.issuedOn;
        this.form.currency = p.originalAmount !== null ? p.originalCurrency : 'EUR';
        if (this.form.currency !== 'EUR') this.form.eurAmount = centsToInput(p.amount);
        this.lines.set([
            {...emptyLine(), label: p.label || 'Prestation', unitPrice: centsToInput(p.originalAmount ?? p.amount)},
        ]);
        if (p.invoiceNumber) {
            this.form.number = p.invoiceNumber;
            this.numberTouched = true;
        }
    }

    /** Invoice client: address book entry, or the copy frozen in an issued invoice */
    currentClient(): Client | undefined {
        return this.clients().find((c) => c.id === this.form.clientId) ?? (this.stored?.client as Client | undefined);
    }

    /** Client deleted from the address book since the invoice was issued */
    clientMissing() {
        return !!this.form.clientId && !this.clients().some((c) => c.id === this.form.clientId);
    }

    /** Expected regime when the terms lack the client's VAT mention, otherwise null */
    vatMismatch(): VatRegime | null {
        const client = this.currentClient();
        if (!client) return null;
        const regime = vatRegime(client);
        const m = VAT_MENTIONS[regime];
        const ok = this.form.termsFr.includes(m.fr) && (!this.form.english || this.form.termsEn.includes(m.en));
        return ok ? null : regime;
    }

    fixVat() {
        const client = this.currentClient();
        if (client) this.applyVatMention(client);
    }

    /** French invoices must carry the VAT mention matching the client (exemption, reverse charge, export). */
    private applyVatMention(client: Client) {
        const m = VAT_MENTIONS[vatRegime(client)];
        this.form.termsFr = withVatMention(this.form.termsFr, m.fr);
        this.form.termsEn = withVatMention(this.form.termsEn, m.en);
    }

    private async suggestNumber() {
        const {number} = await this.invoicesApi.nextNumber(Number(this.form.issuedOn.slice(0, 4)));
        this.form.number = number;
    }

    /** Client preferences, plus the lines of their last invoice (recurring work). */
    private applyClient(client: Client, copyLines: boolean) {
        this.form.clientId = client.id;
        this.form.english = client.english;
        this.form.currency = client.currency;
        this.applyVatMention(client);
        if (!copyLines) return;
        const last = this.ctx.payments
            .filter((p) => p.invoice?.clientId === client.id)
            .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))[0]?.invoice;
        if (last) {
            this.lines.set(last.lines.map(lineToForm));
            this.form.vatRate = vatRateToInput(last.vatRate);
        }
    }

    selectClient(id: string) {
        const client = this.clients().find((c) => c.id === id);
        if (!client) return;
        // Lines are only replaced while nothing has been entered
        const pristine = !this.stored && this.lines().every((l) => !l.label.trim() && !l.unitPrice.trim());
        this.applyClient(client, pristine);
    }

    addClient(client: Client) {
        this.clients.update((list) => [...list, client].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
        this.selectClient(client.id);
    }

    async setIssuedOn(iso: string) {
        const yearChanged = iso.slice(0, 4) !== this.form.issuedOn.slice(0, 4);
        this.form.issuedOn = iso;
        if (!iso) return;
        if (!this.dueTouched) this.form.dueOn = addDays(iso, this.settings.paymentDays);
        if (yearChanged && !this.numberTouched && !this.stored) {
            try {
                await this.suggestNumber();
            } catch {
                // The number can still be typed by hand
            }
        }
    }

    /** Services offered: the invoice client's own ones first, then the shared ones */
    servicesFor(): Service[] {
        const id = this.form.clientId;
        const own = this.services().filter((s) => id && s.clientId === id);
        return [...own, ...this.services().filter((s) => !s.clientId)];
    }

    addService(service: Service) {
        this.services.update((list) => [...list, service].sort(byLabel));
    }

    /** Adds a catalog service as a line (replacing the initial blank line if it is the only one). */
    addServiceLine(id: string) {
        const sv = this.services().find((x) => x.id === id);
        if (!sv) return;
        const line = lineToForm({...sv, quantity: 1});
        const pristine = (l: LineForm) => !l.label.trim() && !l.unitPrice.trim() && !l.detail.trim();
        this.lines.update((list) => (list.length === 1 && pristine(list[0]) ? [line] : [...list, line]));
    }

    addLine() {
        this.lines.update((list) => [...list, emptyLine()]);
    }

    removeLine(l: LineForm) {
        this.lines.update((list) => list.filter((x) => x !== l));
    }

    totals() {
        return invoiceTotals(this.lines(), this.form.vatRate);
    }
}
