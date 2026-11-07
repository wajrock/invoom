import {z} from 'zod';
import {invoiceLineSchema} from '../invoices/invoice.schema.ts';

/** A ready-made invoice line (without quantity), optionally reserved for one client. */
export const serviceSchema = invoiceLineSchema.omit({quantity: true}).extend({
    clientId: z.uuid().nullable().default(null),
});
export type Service = z.infer<typeof serviceSchema>;
