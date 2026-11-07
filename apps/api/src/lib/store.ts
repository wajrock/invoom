import {asc, eq} from 'drizzle-orm';
import type {Deps} from '../deps.ts';
import {clients, invoiceFiles, payments, settings} from '../db/schema.ts';
import {defaultTaxSettings, normalizeTaxSettings, type Encaissement, type TaxSettings} from './fiscal.ts';
import {DEFAULT_INVOICE_SETTINGS} from './invoice.ts';
import type {Client, InvoiceSettings, PaymentData} from './types.ts';

export async function getSetting<T>({db, cipher}: Deps, key: string, fallback: () => T): Promise<T> {
    // Filtrage par espace assuré par la RLS
    const [row] = await db.select().from(settings).where(eq(settings.key, key));
    return row ? cipher.decryptJson<T>(row.data) : fallback();
}

export async function putSetting({db, cipher}: Deps, key: string, value: unknown) {
    const data = cipher.encryptJson(value);
    await db
        .insert(settings)
        .values({key, data})
        .onConflictDoUpdate({
            target: [settings.workspaceId, settings.key],
            set: {data, updatedAt: new Date()},
        });
}

/** Paramètres fiscaux ; l'ancien format (sans périodes) est converti à la volée. */
export const getTaxSettings = async (deps: Deps): Promise<TaxSettings> =>
    normalizeTaxSettings(await getSetting<TaxSettings>(deps, 'tax', () => defaultTaxSettings()));

export const getInvoiceSettings = (deps: Deps): Promise<InvoiceSettings> =>
    getSetting<InvoiceSettings>(deps, 'invoice', () => DEFAULT_INVOICE_SETTINGS);

export interface FileMeta {
    name: string;
    mime: string;
    size: number;
    /** Fichier produit par le générateur de factures (remplacé à chaque régénération) */
    generated?: boolean;
}

/** Fiches créées avant le choix du pays : code déduit du nom de pays saisi. */
export function guessCountryCode(country: string): Client['countryCode'] {
    const c = country.trim().toLowerCase();
    if (['france', 'fr'].includes(c)) return 'FR';
    if (['italie', 'italy', 'italia', 'it'].includes(c)) return 'IT';
    if (['allemagne', 'germany', 'deutschland', 'de'].includes(c)) return 'DE';
    return 'OTHER';
}

function decryptClient(cipher: Deps['cipher'], id: string, data: Buffer) {
    const c = cipher.decryptJson<Client>(data);
    return {id, ...c, countryCode: c.countryCode ?? guessCountryCode(c.country)};
}

export async function listClients({db, cipher}: Deps) {
    const rows = await db.select().from(clients);
    return rows.map((r) => decryptClient(cipher, r.id, r.data)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function getClient({db, cipher}: Deps, id: string) {
    const [row] = await db.select().from(clients).where(eq(clients.id, id));
    return row ? decryptClient(cipher, row.id, row.data) : null;
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
            // Paiements antérieurs au carnet de clients / au générateur
            clientId: data.clientId ?? null,
            invoice: data.invoice ?? null,
            files: files
                .filter((f) => f.paymentId === r.id)
                .map((f) => ({
                    id: f.id,
                    lang: f.lang,
                    ...cipher.decryptJson<FileMeta>(f.meta),
                })),
        };
    });
}

/** Encaissements effectifs (paiements reçus) servant au calcul du CA. */
export async function listEncaissements({db, cipher}: Deps): Promise<Encaissement[]> {
    const rows = await db.select({paidOn: payments.paidOn, data: payments.data}).from(payments);
    return rows
        .filter((r): r is {paidOn: string; data: Buffer} => r.paidOn !== null)
        .map((r) => ({
            paidOn: r.paidOn,
            amount: cipher.decryptJson<PaymentData>(r.data).amount,
        }));
}
