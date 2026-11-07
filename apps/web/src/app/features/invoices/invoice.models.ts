import type {ClientInput} from '../clients/client.models';

export interface InvoiceLine {
    label: string;
    labelEn: string;
    detail: string;
    detailEn: string;
    unit: string;
    unitEn: string;
    quantity: number;
    /** Unit price excluding VAT, in cents */
    unitPrice: number;
}

export interface InvoiceInput {
    clientId: string;
    number: string;
    issuedOn: string;
    dueOn: string;
    periodFrom: string | null;
    periodTo: string | null;
    currency: string;
    vatRate: number;
    lines: InvoiceLine[];
    english: boolean;
    termsFr: string;
    termsEn: string;
}

/** Invoice stored with its payment (client details frozen at issue time) */
export interface StoredInvoice extends InvoiceInput {
    client: ClientInput;
    generatedAt: string;
}

export interface GenerateInvoice {
    paymentId: string | null;
    invoice: InvoiceInput;
    /** Amount in euro cents when the invoice uses another currency */
    eurAmount: number | null;
}

export interface InvoiceSettings {
    paymentDays: number;
    termsFr: string;
    termsEn: string;
}
