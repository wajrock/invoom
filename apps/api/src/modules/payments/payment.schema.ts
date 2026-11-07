import {z} from 'zod';
import {cents, currencyCode, isoDate} from '../../core/validation.ts';
import type {StoredInvoice} from '../invoices/invoice.schema.ts';

export const paymentSchema = z.object({
    clientId: z.uuid().nullable().default(null),
    /** Client name, kept for history even if the client is deleted. */
    client: z.string().min(1).max(200),
    label: z.string().max(500).default(''),
    invoiceNumber: z.string().max(80).default(''),
    issuedOn: isoDate,
    paidOn: isoDate.nullable().default(null),
    /** Amount received in euros: this is what counts for revenue. */
    amount: cents,
    /** Amount invoiced in the original currency, when not in euros. */
    originalAmount: cents.nullable().default(null),
    originalCurrency: currencyCode.default('EUR'),
    notes: z.string().max(4000).default(''),
});
export type Payment = z.infer<typeof paymentSchema>;

/** Encrypted part of a payment (dates stay in clear for sorting and filtering). */
export type PaymentData = Omit<Payment, 'issuedOn' | 'paidOn'> & {
    invoice?: StoredInvoice | null;
};
