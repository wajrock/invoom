import type {Client} from '../clients/client.schema.ts';
import {invoiceTotals} from '../invoices/invoice.ts';
import type {InvoiceLine, InvoiceSettings, StoredInvoice} from '../invoices/invoice.schema.ts';
import {VAT_MENTIONS, vatRegime, withVatMention} from '../invoices/vat-mention.ts';
import type {ApiCall} from './mcp.shared.ts';

/** A payment as GET /api/payments returns it */
export interface PaymentRow {
    id: string;
    client: string;
    label: string;
    invoiceNumber: string;
    issuedOn: string;
    paidOn: string | null;
    amount: number;
    invoice: StoredInvoice | null;
    files?: unknown[];
}

const today = () => new Date().toISOString().slice(0, 10);

function addDays(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function nextMonth(): string {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
}

/** Unpaid invoices due in the month, and those already late (they may come in too) */
export function expectedIncome(payments: PaymentRow[], month = nextMonth()) {
    const pending = payments
        .filter((p) => !p.paidOn)
        .map((p) => ({
            id: p.id,
            client: p.client,
            label: p.label,
            invoiceNumber: p.invoiceNumber,
            amount: p.amount,
            dueOn: p.invoice?.dueOn ?? null,
        }));
    const dueInMonth = pending.filter((p) => p.dueOn?.startsWith(month));
    const late = pending.filter((p) => p.dueOn && p.dueOn < today());
    const sum = (list: {amount: number}[]) => list.reduce((s, p) => s + p.amount, 0);
    return {
        month,
        dueInMonth: {total: sum(dueInMonth), invoices: dueInMonth},
        late: {total: sum(late), invoices: late},
        withoutDueDate: pending.filter((p) => !p.dueOn),
    };
}

export interface InvoiceInput {
    clientId: string;
    lines: InvoiceLine[];
    issuedOn?: string;
    paymentDays?: number;
    periodFrom?: string;
    periodTo?: string;
    english?: boolean;
    eurAmount?: number;
    paymentId?: string;
}

/**
 * The invoice the web form would build: next number (or the replaced invoice's), default delay and terms with the
 * VAT mention this client needs.
 */
export async function invoicePlan(api: ApiCall, input: InvoiceInput) {
    const clients = await api<(Client & {id: string})[]>('GET', '/api/clients');
    const client = clients.find((c) => c.id === input.clientId);
    if (!client) throw new Error('Client introuvable');
    const settings = await api<InvoiceSettings>('GET', '/api/invoices/settings');

    const issuedOn = input.issuedOn ?? today();
    let number: string;
    if (input.paymentId) {
        const payment = (await api<PaymentRow[]>('GET', '/api/payments')).find((p) => p.id === input.paymentId);
        if (!payment) throw new Error('Paiement introuvable');
        number = payment.invoice?.number || payment.invoiceNumber;
    } else {
        number = (await api<{number: string}>('GET', `/api/invoices/next-number?year=${issuedOn.slice(0, 4)}`)).number;
    }

    const mention = VAT_MENTIONS[vatRegime(client)];
    const english = input.english ?? client.english;
    const invoice = {
        clientId: client.id,
        number,
        issuedOn,
        dueOn: addDays(issuedOn, input.paymentDays ?? settings.paymentDays),
        periodFrom: input.periodFrom ?? null,
        periodTo: input.periodTo ?? null,
        currency: client.currency,
        vatRate: 0,
        lines: input.lines,
        english,
        termsFr: withVatMention(settings.termsFr, mention.fr),
        termsEn: english ? withVatMention(settings.termsEn, mention.en) : '',
    };
    const {ht} = invoiceTotals(invoice);
    return {
        request: {invoice, paymentId: input.paymentId ?? null, eurAmount: input.eurAmount ?? null},
        summary: {
            number,
            client: client.name,
            issuedOn,
            dueOn: invoice.dueOn,
            currency: client.currency,
            totalExclTax: ht,
            english,
            lines: input.lines,
            replaces: input.paymentId ?? null,
        },
    };
}
