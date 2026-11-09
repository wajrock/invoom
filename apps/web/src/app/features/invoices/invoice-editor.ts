import {inject, Injectable, signal} from '@angular/core';
import {addDays, daysBetween, todayIso} from '../../shared/utils/dates';
import {reactiveForm} from '../../shared/utils/reactive-form';
import type {Client} from '../clients/client.models';
import {VAT_MENTIONS, vatRegime, type VatRegime} from '../clients/countries';
import {CompanyApi} from '../company/company.api';
import type {Payment} from '../payments/payment.models';
import type {Service} from '../services/service.models';
import {ServicesApi} from '../services/services.api';
import {
    lastInvoiceOf,
    missingCompanyFields,
    nextDefaults,
    paymentDayOptions,
    paymentPrefill,
    servicesForClient,
    storedInvoiceForm,
    withClientVat,
    type Terms,
} from './invoice-defaults';
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
    /** Starts empty: lines are added by hand or from the catalog */
    readonly lines = signal<LineForm[]>([]);
    readonly missingCompany = signal<string[]>([]);
    /** Save the terms and payment delay as defaults for the next invoices */
    readonly saveDefaults = signal(false);
    /** Off: the default terms from the settings, with the client's VAT mention, are used as is */
    readonly customTerms = signal(false);

    /** Shared by the dialog sections, hence signal-backed fields */
    readonly form: InvoiceForm = reactiveForm<InvoiceForm>({
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
    });
    /** Edited by hand: no longer derived from the issue date */
    numberTouched = false;
    /** Payment delay: the due date always follows the issue date */
    paymentDays = 7;
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
        this.missingCompany.set(missingCompanyFields(company));

        const s = this.stored;
        const p = ctx.payment;
        if (s) {
            // Already generated: reload exactly what was entered
            Object.assign(this.form, storedInvoiceForm(s, p!.amount));
            this.lines.set(s.lines.map(lineToForm));
            this.numberTouched = true;
            this.paymentDays = Math.max(0, daysBetween(s.issuedOn, s.dueOn));
            const d = this.defaultTerms();
            this.customTerms.set(s.termsFr !== d.fr || (s.english && s.termsEn !== d.en));
        } else {
            this.form.termsFr = settings.termsFr;
            this.form.termsEn = settings.termsEn;
            if (p) this.prefillFromPayment(p);
            else if (ctx.clientId) {
                const client = this.clients().find((c) => c.id === ctx.clientId);
                if (client) this.applyClient(client);
            }
            this.setPaymentDays(settings.paymentDays);
            if (!this.numberTouched) await this.suggestNumber();
        }
        this.ready.set(true);
    }

    /** Payment entered by hand: start from its details */
    private prefillFromPayment(p: Payment) {
        const client = this.clients().find(
            (c) => c.id === p.clientId || c.name.toLowerCase() === p.client.toLowerCase(),
        );
        if (client) this.applyClient(client);
        const prefill = paymentPrefill(p);
        Object.assign(this.form, prefill.form);
        this.lines.set([prefill.line]);
        this.numberTouched = !!p.invoiceNumber;
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

    /** Settings terms, with the VAT mention of the current client */
    private defaultTerms(): Terms {
        const terms = {fr: this.settings.termsFr, en: this.settings.termsEn};
        const client = this.currentClient();
        return client ? withClientVat(terms, client) : terms;
    }

    setCustomTerms(custom: boolean) {
        this.customTerms.set(custom);
        if (custom) return;
        const d = this.defaultTerms();
        this.form.termsFr = d.fr;
        this.form.termsEn = d.en;
    }

    /** French invoices must carry the VAT mention matching the client (exemption, reverse charge, export). */
    private applyVatMention(client: Client) {
        const terms = withClientVat({fr: this.form.termsFr, en: this.form.termsEn}, client);
        this.form.termsFr = terms.fr;
        this.form.termsEn = terms.en;
    }

    /** Settings to store when "keep for the next invoices" is on */
    defaultsToSave(): InvoiceSettings {
        const custom = this.customTerms() ? {fr: this.form.termsFr, en: this.form.termsEn} : null;
        return nextDefaults(this.settings, this.paymentDays, custom);
    }

    private async suggestNumber() {
        const {number} = await this.invoicesApi.nextNumber(Number(this.form.issuedOn.slice(0, 4)));
        this.form.number = number;
    }

    /** Client preferences: language, currency and VAT mention. */
    private applyClient(client: Client) {
        this.form.clientId = client.id;
        this.form.english = client.english;
        this.form.currency = client.currency;
        this.applyVatMention(client);
    }

    selectClient(id: string) {
        const client = this.clients().find((c) => c.id === id);
        if (client) this.applyClient(client);
    }

    lastInvoice(): StoredInvoice | undefined {
        const id = this.form.clientId;
        return id && !this.stored ? lastInvoiceOf(this.ctx.payments, id) : undefined;
    }

    copyLastInvoice() {
        const last = this.lastInvoice();
        if (!last) return;
        this.lines.update((list) => [...list, ...last.lines.map(lineToForm)]);
        this.form.vatRate = vatRateToInput(last.vatRate);
    }

    addClient(client: Client) {
        this.clients.update((list) => [...list, client].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
        this.selectClient(client.id);
    }

    setPaymentDays(days: number) {
        this.paymentDays = days;
        if (this.form.issuedOn) this.form.dueOn = addDays(this.form.issuedOn, days);
    }

    paymentDayOptions(): number[] {
        return paymentDayOptions(this.paymentDays);
    }

    async setIssuedOn(iso: string) {
        const yearChanged = iso.slice(0, 4) !== this.form.issuedOn.slice(0, 4);
        this.form.issuedOn = iso;
        if (!iso) return;
        this.form.dueOn = addDays(iso, this.paymentDays);
        if (yearChanged && !this.numberTouched && !this.stored) {
            try {
                await this.suggestNumber();
            } catch {
                // The number can still be typed by hand
            }
        }
    }

    servicesFor(): Service[] {
        return servicesForClient(this.services(), this.form.clientId);
    }

    addService(service: Service) {
        this.services.update((list) => [...list, service].sort(byLabel));
    }

    /** Adds a catalog service as a new line. */
    addServiceLine(id: string) {
        const sv = this.services().find((x) => x.id === id);
        if (!sv) return;
        this.lines.update((list) => [...list, lineToForm({...sv, quantity: 1})]);
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
