import {asc} from 'drizzle-orm';
import type {Deps} from '../../core/deps.ts';
import {invoiceFiles, payments} from '../../db/schema/index.ts';
import type {Encaissement} from '../fiscal/index.ts';
import type {PaymentData} from './payment.schema.ts';

export interface FileMeta {
    name: string;
    mime: string;
    size: number;
    /** Produced by the invoice generator, hence replaced on each regeneration. */
    generated?: boolean;
}

export async function listPayments({db, cipher}: Deps) {
    const rows = await db.select().from(payments).orderBy(asc(payments.issuedOn));
    const files = await db
        .select({
            id: invoiceFiles.id,
            paymentId: invoiceFiles.paymentId,
            lang: invoiceFiles.lang,
            meta: invoiceFiles.meta,
        })
        .from(invoiceFiles)
        .orderBy(asc(invoiceFiles.createdAt));
    return rows.map((r) => {
        const data = cipher.decryptJson<PaymentData>(r.data);
        return {
            id: r.id,
            issuedOn: r.issuedOn,
            paidOn: r.paidOn,
            ...data,
            // Payments recorded before the client book and the invoice generator existed
            clientId: data.clientId ?? null,
            invoice: data.invoice ?? null,
            files: files
                .filter((f) => f.paymentId === r.id)
                .map((f) => ({id: f.id, lang: f.lang, ...cipher.decryptJson<FileMeta>(f.meta)})),
        };
    });
}

/** Payments actually received: the basis for revenue and contributions. */
export async function listEncaissements({db, cipher}: Deps): Promise<Encaissement[]> {
    const rows = await db.select({paidOn: payments.paidOn, data: payments.data}).from(payments);
    return rows
        .filter((r): r is {paidOn: string; data: Buffer} => r.paidOn !== null)
        .map((r) => ({paidOn: r.paidOn, amount: cipher.decryptJson<PaymentData>(r.data).amount}));
}
