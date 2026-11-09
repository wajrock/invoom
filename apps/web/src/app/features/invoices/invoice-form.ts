import {centsToInput, parseEuros, parsePercent, percentToInput} from '../../shared/utils/money';
import type {GenerateInvoice, InvoiceLine} from './invoice.models';

/** Editable invoice line: quantity and price as text */
export interface LineForm {
    key: number;
    label: string;
    labelEn: string;
    detail: string;
    detailEn: string;
    unit: string;
    unitEn: string;
    quantity: string;
    unitPrice: string;
}

export interface InvoiceForm {
    clientId: string;
    number: string;
    issuedOn: string;
    dueOn: string;
    periodFrom: string;
    periodTo: string;
    currency: string;
    vatRate: string;
    english: boolean;
    termsFr: string;
    termsEn: string;
    eurAmount: string;
}

let nextKey = 1;

/** "2,5" → 2.5 (null when invalid) */
function parseQty(v: string): number | null {
    const s = v.replace(/\s/g, '').replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** VAT rate as a fraction; blank means 0 */
function parseVatRate(v: string): number | null {
    return v.replace(/[\s%]/g, '') === '' ? 0 : parsePercent(v, 2);
}

export const vatRateToInput = (rate: number) => percentToInput(rate, 2);

export function lineToForm(l: InvoiceLine): LineForm {
    return {
        key: nextKey++,
        label: l.label,
        labelEn: l.labelEn,
        detail: l.detail,
        detailEn: l.detailEn,
        unit: l.unit,
        unitEn: l.unitEn,
        quantity: String(l.quantity).replace('.', ','),
        unitPrice: centsToInput(l.unitPrice),
    };
}

export const emptyLine = (): LineForm => ({
    key: nextKey++,
    label: '',
    labelEn: '',
    detail: '',
    detailEn: '',
    unit: '',
    unitEn: '',
    quantity: '1',
    unitPrice: '',
});

/** Line total in cents (null when quantity or price is invalid) */
export function lineTotal(l: LineForm): number | null {
    const q = parseQty(l.quantity);
    const p = parseEuros(l.unitPrice);
    return q !== null && p !== null ? Math.round(q * p) : null;
}

export function invoiceTotals(lines: LineForm[], vatRate: string) {
    const ht = lines.reduce((sum, l) => sum + (lineTotal(l) ?? 0), 0);
    const vat = Math.round(ht * (parseVatRate(vatRate) ?? 0));
    return {ht, vat, ttc: ht + vat};
}

/** Builds the API request, or returns the first validation error. */
export function buildRequest(
    f: InvoiceForm,
    lineForms: LineForm[],
    paymentId: string | null,
): GenerateInvoice | string {
    if (!f.clientId) return 'Choisis un client';
    if (!f.number.trim()) return 'Numéro de facture requis';
    if (!f.issuedOn || !f.dueOn) return 'Dates de facture et d’échéance requises';
    if (f.dueOn < f.issuedOn) return 'L’échéance précède la date de facture';
    if (f.periodFrom && f.periodTo && f.periodFrom > f.periodTo) return 'Période de prestation invalide';
    const vatRate = parseVatRate(f.vatRate);
    if (vatRate === null) return 'Taux de TVA invalide';

    if (!lineForms.length) return 'Ajoute au moins une prestation';
    const lines: InvoiceLine[] = [];
    for (const [i, l] of lineForms.entries()) {
        const quantity = parseQty(l.quantity);
        const unitPrice = parseEuros(l.unitPrice);
        if (!l.label.trim()) return `Ligne ${i + 1} : désignation requise`;
        if (quantity === null) return `Ligne ${i + 1} : quantité invalide`;
        if (unitPrice === null) return `Ligne ${i + 1} : prix invalide`;
        lines.push({
            label: l.label.trim(),
            labelEn: l.labelEn.trim(),
            detail: l.detail.trim(),
            detailEn: l.detailEn.trim(),
            unit: l.unit.trim(),
            unitEn: l.unitEn.trim(),
            quantity,
            unitPrice,
        });
    }

    let eurAmount: number | null = null;
    if (f.currency !== 'EUR') {
        eurAmount = parseEuros(f.eurAmount);
        if (eurAmount === null) return 'Indique le montant en euros (utilisé pour le CA)';
    }

    return {
        paymentId,
        eurAmount,
        invoice: {
            clientId: f.clientId,
            number: f.number.trim(),
            issuedOn: f.issuedOn,
            dueOn: f.dueOn,
            periodFrom: f.periodFrom || null,
            periodTo: f.periodTo || null,
            currency: f.currency,
            vatRate,
            lines,
            english: f.english,
            termsFr: f.termsFr,
            termsEn: f.termsEn,
        },
    };
}
