import {z} from 'zod';
import {cents, currencyCode, isoDate} from '../../core/validation.ts';
import type {Client} from '../clients/client.schema.ts';

export const invoiceLineSchema = z.object({
    label: z.string().trim().min(1).max(200),
    labelEn: z.string().trim().max(200).default(''),
    detail: z.string().trim().max(500).default(''),
    detailEn: z.string().trim().max(500).default(''),
    unit: z.string().trim().max(40).default(''),
    unitEn: z.string().trim().max(40).default(''),
    quantity: z.number().positive().max(1_000_000),
    /** Unit price excluding VAT, in cents of the invoice currency. */
    unitPrice: cents,
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const invoiceSettingsSchema = z.object({
    paymentDays: z.number().int().min(0).max(120),
    termsFr: z.string().max(4000),
    termsEn: z.string().max(4000),
});
export type InvoiceSettings = z.infer<typeof invoiceSettingsSchema>;

/** One input, rendered in French (always) and English (optional). */
export const invoiceSchema = z
    .object({
        clientId: z.uuid(),
        number: z
            .string()
            .trim()
            .min(1)
            .max(40)
            .regex(
                /^#?[A-Za-z0-9](?:[A-Za-z0-9_\-/.]*[A-Za-z0-9])?$/,
                'Lettres, chiffres et séparateurs - / . _ (commence et finit par une lettre ou un chiffre)',
            )
            .refine((n) => !/[-/._]{2}/.test(n), 'Séparateurs consécutifs interdits'),
        issuedOn: isoDate,
        dueOn: isoDate,
        periodFrom: isoDate.nullable().default(null),
        periodTo: isoDate.nullable().default(null),
        currency: currencyCode.default('EUR'),
        /** 0 under the French VAT exemption (franchise en base). */
        vatRate: z.number().min(0).max(1).default(0),
        lines: z.array(invoiceLineSchema).min(1, 'Au moins une ligne').max(30),
        english: z.boolean().default(false),
        termsFr: z.string().max(4000).default(''),
        termsEn: z.string().max(4000).default(''),
    })
    .refine((i) => i.dueOn >= i.issuedOn, {message: "L'échéance précède la date de facture", path: ['dueOn']})
    .refine((i) => !i.periodFrom || !i.periodTo || i.periodFrom <= i.periodTo, {
        message: 'Période de prestation invalide',
        path: ['periodTo'],
    });
export type Invoice = z.infer<typeof invoiceSchema>;

/** Stored with its payment; the client is frozen as it was when the invoice was issued. */
export type StoredInvoice = Invoice & {client: Client; generatedAt: string};
