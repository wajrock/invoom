import type {Client} from '../clients/client.models';
import type {Company} from '../company/company.models';
import {VAT_MENTIONS, vatRegime, withVatMention} from '../clients/countries';
import type {Payment} from '../payments/payment.models';
import type {Service} from '../services/service.models';
import {centsToInput} from '../../shared/utils/money';
import {emptyLine, vatRateToInput, type InvoiceForm, type LineForm} from './invoice-form';
import type {InvoiceSettings, StoredInvoice} from './invoice.models';

export interface Terms {
    fr: string;
    en: string;
}

/** Terms with the VAT mention the client needs (exemption, reverse charge, export) */
export function withClientVat(terms: Terms, client: Client): Terms {
    const m = VAT_MENTIONS[vatRegime(client)];
    return {fr: withVatMention(terms.fr, m.fr), en: withVatMention(terms.en, m.en)};
}

/** Payment delays offered, plus the current one when it is unusual (older invoice, custom default) */
export function paymentDayOptions(current: number): number[] {
    return [...new Set([0, 7, 15, 30, 45, 60, current])].sort((a, b) => a - b);
}

/** The client's most recent invoice, to repeat recurring work */
export function lastInvoiceOf(payments: Payment[], clientId: string): StoredInvoice | undefined {
    return (
        payments.filter((p) => p.invoice?.clientId === clientId).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))[0]
            ?.invoice ?? undefined
    );
}

/**
 * Defaults kept for the next invoices: always the payment delay; the terms only when they were customised,
 * since the default ones carry this client's VAT mention and must not become everyone's.
 */
export function nextDefaults(
    settings: InvoiceSettings,
    paymentDays: number,
    customTerms: Terms | null,
): InvoiceSettings {
    return {
        paymentDays: Math.max(0, Math.min(120, paymentDays)),
        termsFr: customTerms?.fr ?? settings.termsFr,
        termsEn: customTerms?.en ?? settings.termsEn,
    };
}

/** Company fields an invoice cannot do without */
const REQUIRED_COMPANY = [
    ['name', 'nom'],
    ['address', 'adresse'],
    ['siret', 'SIRET'],
    ['iban', 'IBAN'],
] as const;

/** Labels of the required company fields still empty */
export function missingCompanyFields(company: Company): string[] {
    return REQUIRED_COMPANY.filter(([id]) => !company.fields.find((f) => f.id === id)?.value.trim()).map(
        ([, label]) => label,
    );
}

/** Form values of an invoice already generated, exactly as entered */
export function storedInvoiceForm(s: StoredInvoice, eurCents: number): InvoiceForm {
    return {
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
        eurAmount: s.currency !== 'EUR' ? centsToInput(eurCents) : '',
    };
}

/** Services offered: the invoice client's own ones first, then the shared ones */
export function servicesForClient(services: Service[], clientId: string): Service[] {
    const own = services.filter((s) => clientId && s.clientId === clientId);
    return [...own, ...services.filter((s) => !s.clientId)];
}

/** A payment entered by hand, as the start of its invoice: date, currency, one line, and its number if any */
export function paymentPrefill(p: Payment): {form: Partial<InvoiceForm>; line: LineForm} {
    const currency = p.originalAmount !== null ? p.originalCurrency : 'EUR';
    return {
        form: {
            issuedOn: p.issuedOn,
            currency,
            ...(currency !== 'EUR' ? {eurAmount: centsToInput(p.amount)} : {}),
            ...(p.invoiceNumber ? {number: p.invoiceNumber} : {}),
        },
        line: {...emptyLine(), label: p.label || 'Prestation', unitPrice: centsToInput(p.originalAmount ?? p.amount)},
    };
}
