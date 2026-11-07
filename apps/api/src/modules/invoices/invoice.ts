import type {Invoice, InvoiceLine, InvoiceSettings} from './invoice.schema.ts';

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
    paymentDays: 7,
    termsFr: [
        'Cette facture concerne uniquement de la prestation de services.',
        'TVA non applicable, art. 293 B du CGI.',
        'Paiement par virement bancaire. Pas d’escompte en cas de paiement anticipé.',
        'En cas de retard de paiement, seront exigibles, conformément au code de commerce, une indemnité calculée sur la base de trois fois le taux de l’intérêt légal en vigueur ainsi qu’une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce).',
    ].join('\n'),
    termsEn: [
        'This invoice relates solely to the provision of services.',
        'VAT not applicable, article 293 B of the French General Tax Code (CGI).',
        'Payment by bank transfer. Please quote the invoice number when remitting funds. No discount for early payment.',
        'Late payment: interest at three times the French statutory interest rate, plus a fixed recovery fee of €40 (Art. L441-10 and D441-5 of the French Commercial Code).',
    ].join('\n'),
};

/** Line total, rounded to the cent. */
export const lineTotal = (l: Pick<InvoiceLine, 'quantity' | 'unitPrice'>) => Math.round(l.quantity * l.unitPrice);

export function invoiceTotals(inv: Pick<Invoice, 'lines' | 'vatRate'>) {
    const ht = inv.lines.reduce((s, l) => s + lineTotal(l), 0);
    const vat = Math.round(ht * inv.vatRate);
    return {ht, vat, ttc: ht + vat};
}

/** Next YYYY-NNN number after those already used that year (French invoices must be numbered without gaps). */
export function nextInvoiceNumber(existing: string[], year: number): string {
    const re = new RegExp(`^#?${year}-(\\d+)$`);
    let max = 0;
    for (const n of existing) {
        const m = re.exec(n.trim());
        if (m) max = Math.max(max, Number(m[1]));
    }
    return `${year}-${String(max + 1).padStart(3, '0')}`;
}

/** Safe file name: "Facture-2026-001.pdf" / "Invoice-2026-001.pdf". */
export function invoiceFileName(number: string, lang: 'fr' | 'en') {
    const safe = number.replace(/^#/, '').replace(/[^\w.-]+/g, '-');
    return `${lang === 'fr' ? 'Facture' : 'Invoice'}-${safe}.pdf`;
}
