import type {InvoiceLine} from '../invoices/invoice.models';

/** Catalog entry: a reusable invoice line (without quantity) */
export type ServiceInput = Omit<InvoiceLine, 'quantity'> & {
    /** Client the service is reserved for (null = every client) */
    clientId: string | null;
};

export interface Service extends ServiceInput {
    id: string;
}
