import {and, eq, inArray, sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {z} from 'zod';
import {invoiceFiles, payments} from '../db/schema.ts';
import type {Deps} from '../deps.ts';
import {notFound, parseJson} from '../lib/http.ts';
import {invoiceFileName, invoiceTotals, nextInvoiceNumber} from '../lib/invoice.ts';
import {renderInvoicePdf, type InvoiceLang} from '../lib/invoice-pdf.ts';
import {getClient, getInvoiceSettings, listPayments, putSetting, type FileMeta} from '../lib/store.ts';
import {invoiceSchema, invoiceSettingsSchema, type Client, type Invoice, type PaymentData} from '../lib/types.ts';
import {getCompany} from './company.ts';

/** Clé arbitraire du verrou Postgres qui sérialise l'attribution des numéros de facture */
const INVOICE_NUMBER_LOCK = 72_461_001;

const generateSchema = z.object({
    /** Paiement existant à rattacher (sinon un paiement « en attente » est créé) */
    paymentId: z.uuid().nullable().default(null),
    invoice: invoiceSchema,
    /** Montant en euros (centimes) quand la facture est dans une autre devise */
    eurAmount: z.number().int().min(0).max(100_000_000_00).nullable().default(null),
});

export const invoiceRoutes = (deps: Deps) => {
    const {db, cipher} = deps;
    const company = () => getCompany(deps);

    /** Client courant du carnet, ou à défaut la copie figée dans la facture déjà émise. */
    async function resolveClient(invoice: Invoice, paymentId: string | null): Promise<Client> {
        const current = await getClient(deps, invoice.clientId);
        if (current) {
            const {id, ...client} = current;
            void id;
            return client;
        }
        if (paymentId) {
            const p = (await listPayments(deps)).find((x) => x.id === paymentId);
            if (p?.invoice && p.invoice.clientId === invoice.clientId) return p.invoice.client;
        }
        throw new HTTPException(400, {message: 'Client introuvable'});
    }

    return new Hono()
        .get('/settings', async (c) => c.json(await getInvoiceSettings(deps)))
        .put('/settings', async (c) => {
            const body = await parseJson(c, invoiceSettingsSchema);
            await putSetting(deps, 'invoice', body);
            return c.json(body);
        })
        .get('/next-number', async (c) => {
            const year = Number(c.req.query('year')) || new Date().getFullYear();
            const numbers = (await listPayments(deps)).map((p) => p.invoiceNumber);
            return c.json({number: nextInvoiceNumber(numbers, year)});
        })
        .post('/preview', async (c) => {
            const lang: InvoiceLang = c.req.query('lang') === 'en' ? 'en' : 'fr';
            const {invoice, paymentId} = await parseJson(c, generateSchema);
            const client = await resolveClient(invoice, paymentId);
            const pdf = await renderInvoicePdf({invoice, client, company: await company(), lang});
            return c.body(new Uint8Array(pdf), 200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${invoiceFileName(invoice.number, lang)}"`,
                'Cache-Control': 'private, no-store',
            });
        })
        .post('/', async (c) => {
            const {invoice, paymentId, eurAmount} = await parseJson(c, generateSchema);
            const client = await resolveClient(invoice, paymentId);

            const all = await listPayments(deps);
            const existing = paymentId ? (all.find((p) => p.id === paymentId) ?? notFound()) : null;

            const {ht} = invoiceTotals(invoice);
            const isEur = invoice.currency === 'EUR';
            if (!isEur && eurAmount === null) {
                throw new HTTPException(400, {message: 'Indique le montant en euros pour une facture en devise'});
            }

            const langs: InvoiceLang[] = invoice.english ? ['fr', 'en'] : ['fr'];
            const companyData = await company();
            const pdfs = await Promise.all(
                langs.map(async (lang) => ({
                    lang,
                    pdf: await renderInvoicePdf({invoice, client, company: companyData, lang}),
                })),
            );

            const data: PaymentData = {
                clientId: invoice.clientId,
                client: client.name,
                label: invoice.lines[0].label,
                invoiceNumber: invoice.number,
                // Le CA d'un micro-entrepreneur se déclare hors taxes
                amount: isEur ? ht : eurAmount!,
                originalAmount: isEur ? null : ht,
                originalCurrency: invoice.currency,
                notes: existing?.notes ?? '',
                invoice: {...invoice, client, generatedAt: new Date().toISOString()},
            };

            const id = await db.transaction(async (tx) => {
                // Verrou + contrôle dans la transaction : deux générations simultanées ne peuvent pas prendre le même numéro
                await tx.execute(sql`select pg_advisory_xact_lock(${INVOICE_NUMBER_LOCK})`);
                const number = invoice.number.toLowerCase();
                const clash = (await tx.select({id: payments.id, data: payments.data}).from(payments))
                    .filter((r) => r.id !== paymentId)
                    .map((r) => cipher.decryptJson<PaymentData>(r.data))
                    .find((p) => p.invoiceNumber.trim().toLowerCase() === number);
                if (clash)
                    throw new HTTPException(409, {
                        message: `Le numéro ${invoice.number} est déjà utilisé (${clash.client})`,
                    });

                let id: string;
                if (existing) {
                    id = existing.id;
                    await tx
                        .update(payments)
                        .set({issuedOn: invoice.issuedOn, data: cipher.encryptJson(data)})
                        .where(eq(payments.id, id));
                    // Remplace uniquement les PDF générés précédemment ; les fichiers déposés à la main restent
                    const files = await tx
                        .select({id: invoiceFiles.id, meta: invoiceFiles.meta})
                        .from(invoiceFiles)
                        .where(eq(invoiceFiles.paymentId, id));
                    const generated = files
                        .filter((f) => cipher.decryptJson<FileMeta>(f.meta).generated)
                        .map((f) => f.id);
                    if (generated.length) {
                        await tx
                            .delete(invoiceFiles)
                            .where(and(eq(invoiceFiles.paymentId, id), inArray(invoiceFiles.id, generated)));
                    }
                } else {
                    const [row] = await tx
                        .insert(payments)
                        .values({issuedOn: invoice.issuedOn, paidOn: null, data: cipher.encryptJson(data)})
                        .returning({id: payments.id});
                    id = row.id;
                }
                for (const {lang, pdf} of pdfs) {
                    const meta: FileMeta = {
                        name: invoiceFileName(invoice.number, lang),
                        mime: 'application/pdf',
                        size: pdf.length,
                        generated: true,
                    };
                    await tx
                        .insert(invoiceFiles)
                        .values({paymentId: id, lang, meta: cipher.encryptJson(meta), content: cipher.encrypt(pdf)});
                }
                return id;
            });

            const saved = (await listPayments(deps)).find((p) => p.id === id);
            return c.json(saved, existing ? 200 : 201);
        });
};
