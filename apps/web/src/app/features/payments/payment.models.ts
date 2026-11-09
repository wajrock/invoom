import type {StoredInvoice} from '../invoices/invoice.models';

export type FileLang = 'fr' | 'en' | 'other';

export const LANG_LABELS: Record<FileLang, string> = {
    fr: 'FR',
    en: 'EN',
    other: 'Autre',
};

const LANG_ORDER: Record<FileLang, number> = {fr: 0, en: 1, other: 2};

/** FR before EN, whatever the upload order */
export function filesInOrder(files: InvoiceFile[]): InvoiceFile[] {
    return [...files].sort((a, b) => LANG_ORDER[a.lang] - LANG_ORDER[b.lang]);
}

export interface InvoiceFile {
    id: string;
    lang: FileLang;
    name: string;
    mime: string;
    size: number;
    /** PDF produced by the invoice generator (replaced on each regeneration) */
    generated?: boolean;
}

export interface PaymentInput {
    clientId: string | null;
    client: string;
    label: string;
    invoiceNumber: string;
    issuedOn: string;
    paidOn: string | null;
    amount: number;
    originalAmount: number | null;
    originalCurrency: string;
    notes: string;
}

export interface Payment extends PaymentInput {
    id: string;
    files: InvoiceFile[];
    invoice: StoredInvoice | null;
}

/** Row actions shared by the desktop menu and the mobile sheet */
export type PaymentAction = 'paid' | 'invoice' | 'edit' | 'delete';

export function paymentInput(p: Payment): PaymentInput {
    const {id: _id, files: _files, invoice: _invoice, ...input} = p;
    return input;
}
