import PDFDocument from 'pdfkit';
import type {Client} from '../../clients/client.schema.ts';
import type {Company} from '../../company/company.schema.ts';
import {invoiceTotals, lineTotal} from '../invoice.ts';
import type {Invoice} from '../invoice.schema.ts';
import {formatters, safe} from './format.ts';
import {LABELS, type InvoiceLang} from './labels.ts';
import {BOTTOM, COLORS, CW, FONTS, GEIST_ASCENT, GEIST_CAP, M, PAGE_H, type Weight} from './theme.ts';

export interface RenderInput {
    invoice: Invoice;
    client: Client;
    company: Company;
    lang: InvoiceLang;
}

export function renderInvoicePdf({invoice, client, company, lang}: RenderInput): Promise<Buffer> {
    const t = LABELS[lang];
    const f = formatters(lang, invoice.currency);
    const field = (id: string) => company.fields.find((x) => x.id === id)?.value.trim() ?? '';
    const totals = invoiceTotals(invoice);
    const sellerName = field('name') || '—';

    const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        bufferPages: true,
        info: {
            Title: safe(`${t.title} ${invoice.number}`),
            Author: safe(sellerName),
            Subject: safe(`${t.title} ${invoice.number} – ${client.name}`),
        },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

    for (const w of Object.keys(FONTS) as Weight[]) doc.registerFont(w, FONTS[w]);
    /** true = semibold (headings), false = regular */
    const font = (weight: boolean | Weight, size: number, color = COLORS.ink) =>
        doc
            .font(weight === true ? 'semibold' : weight === false ? 'regular' : weight)
            .fontSize(size)
            .fillColor(color);
    // No ligatures (tt, fi…): otherwise copied or indexed text loses letters ("Cete" instead of "Cette")
    const noLig = {
        features: {
            liga: false,
            clig: false,
            dlig: false,
        } as unknown as PDFKit.Mixins.OpenTypeFeatures[],
    };
    const text = (s: string, x: number, y: number, opts: PDFKit.Mixins.TextOptions = {}) =>
        doc.text(safe(s), x, y, {...noLig, ...opts});
    const height = (s: string, width: number, opts: PDFKit.Mixins.TextOptions = {}) =>
        doc.heightOfString(safe(s), {width, ...noLig, ...opts});

    let y = M;
    const ensure = (h: number) => {
        if (y + h <= BOTTOM) return false;
        doc.addPage();
        y = M;
        return true;
    };

    // ── Seller and client blocks, drawn under the title
    type Party = {name: string; lines: string[]; rows: [string, string][]};
    const lines = (s: string) =>
        s
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
    // A short legal form (EI, EURL…) sits next to the name, as French law requires for "EI"; longer ones get their own line
    const legal = field('legal');
    const shortLegal = legal.length > 0 && legal.length <= 6;
    const seller: Party = {
        name: shortLegal ? `${sellerName} ${legal}` : sellerName,
        lines: lines(field('address')),
        rows: (
            [
                [t.legal, shortLegal ? '' : legal],
                [t.siret, field('siret')],
                [t.vat, field('vat')],
                [t.email, field('email')],
                [t.phone, field('phone')],
            ] as [string, string][]
        ).filter(([, v]) => v),
    };
    // The country is not added: it is usually part of the address already
    const buyer: Party = {
        name: client.name,
        lines: lines(client.address),
        rows: (
            [
                [t.reg, client.registration],
                [t.vat, client.vatNumber],
                [t.email, client.email],
                ...client.extra.map((e) => [e.label, e.value]),
            ] as [string, string][]
        ).filter(([, v]) => v),
    };

    const colW = (CW - 32) / 2;
    /** Line gap in the seller and client blocks */
    const PARTY_GAP = 5;
    const sep = lang === 'fr' ? '\u00a0: ' : ': ';
    /** Draws an identity block and returns its height */
    const drawParty = (p: Party, x: number, align: 'left' | 'right') => {
        let py = y;
        font('semibold', 12);
        text(p.name, x, py, {width: colW, align});
        // Name kept close to the address: they read as one group
        py += height(p.name, colW) + 2;
        font(false, 9.5);
        for (const l of p.lines) {
            text(l, x, py, {width: colW, align});
            py += height(l, colW) + PARTY_GAP;
        }
        if (p.rows.length) py += PARTY_GAP + 3;
        for (const [label, value] of p.rows) {
            // Grey label and black value on one line; positions are measured because pdfkit's `continued` can't right-align
            font(false, 9.5);
            const lw = doc.widthOfString(safe(label + sep), noLig);
            const vw = doc.widthOfString(safe(value), noLig);
            if (lw + vw <= colW) {
                const lx = align === 'right' ? x + colW - lw - vw : x;
                font(false, 9.5, COLORS.muted);
                text(label + sep, lx, py, {lineBreak: false});
                font(false, 9.5);
                text(value, lx + lw, py, {lineBreak: false});
                py += height(value, colW) + PARTY_GAP;
            } else {
                // Value too long: label, then the value on its own line
                font(false, 9.5, COLORS.muted);
                text(label, x, py, {width: colW, align});
                py += height(label, colW) + 1;
                font(false, 9.5);
                text(value, x, py, {width: colW, align});
                py += height(value, colW) + PARTY_GAP;
            }
        }
        return py - y;
    };
    // ── Title and dates
    font('bold', 22, COLORS.accent);
    text(`${t.title} #${invoice.number.replace(/^#/, '')}`, M, y, {
        lineBreak: false,
    });
    y += 32;
    font(false, 9.5, COLORS.muted);
    text(`${t.issuedOn} ${f.date(invoice.issuedOn)}   ·   ${t.dueOn} ${f.date(invoice.dueOn)}`, M, y);
    y += 15;
    const period =
        invoice.periodFrom && invoice.periodTo
            ? lang === 'fr'
                ? `du ${f.date(invoice.periodFrom)} au ${f.date(invoice.periodTo)}`
                : `${f.date(invoice.periodFrom)} – ${f.date(invoice.periodTo)}`
            : invoice.periodFrom || invoice.periodTo
              ? f.date((invoice.periodFrom ?? invoice.periodTo)!)
              : '';
    // The service date is a legal mention when it differs from the invoice date
    if (period) {
        text(`${t.period} ${period}`, M, y);
        y += 15;
    }
    y += 26;

    // ── Seller on the left, client on the right
    const partyH = Math.max(drawParty(seller, M, 'left'), drawParty(buyer, M + CW - colW, 'right'));
    y += partyH + 28;

    // ── Invoice lines
    const unitOf = (l: (typeof invoice.lines)[number]) => (lang === 'en' ? l.unitEn || l.unit : l.unit) ?? '';
    // The unit is optional: with no unit on any line, its column goes to the description
    const hasUnit = invoice.lines.some((l) => unitOf(l).trim());
    const cols = [
        {key: 'desc', w: hasUnit ? 214 : 289, align: 'left' as const},
        {key: 'qty', w: 40, align: 'right' as const},
        ...(hasUnit ? [{key: 'unit', w: 75, align: 'left' as const}] : []),
        {key: 'price', w: 80, align: 'right' as const},
        {key: 'total', w: 90, align: 'right' as const},
    ];
    const cellPad = 10;
    const headerH = 26;
    /** Baseline that centers capital letters vertically in a band */
    const bandTextY = (top: number) => top + headerH / 2 - 9 * (GEIST_ASCENT - GEIST_CAP / 2);
    /** Title band of secondary blocks: same shape as the table header, in pastel */
    const drawBand = (title: string, x: number, w: number) => {
        doc.roundedRect(x, y, w, headerH, 6).fill(COLORS.accentSoft);
        font('medium', 9, COLORS.accent);
        text(title, x + cellPad, bandTextY(y), {
            width: w - 2 * cellPad,
            lineBreak: false,
        });
    };
    const drawHeader = () => {
        doc.roundedRect(M, y, CW, headerH, 6).fill(COLORS.accent);
        font('medium', 9, COLORS.white);
        const ty = bandTextY(y);
        let x = M;
        for (const c of cols) {
            text(t[c.key as keyof typeof t], x + cellPad, ty, {
                width: c.w - 2 * cellPad,
                align: c.align,
                lineBreak: false,
            });
            x += c.w;
        }
        y += headerH;
    };
    ensure(headerH + 40);
    drawHeader();

    for (const line of invoice.lines) {
        const label = lang === 'en' ? line.labelEn || line.label : line.label;
        const detail = lang === 'en' ? line.detailEn || line.detail : line.detail;
        const descW = cols[0].w - 2 * cellPad;
        font(true, 10);
        let h = height(label, descW);
        font(false, 8.5);
        if (detail) h += 3 + height(detail, descW);
        h += 2 * cellPad;

        if (ensure(h)) drawHeader();
        let x = M;
        font(true, 10);
        text(label, x + cellPad, y + cellPad, {width: descW});
        if (detail) {
            const ly = y + cellPad + height(label, descW) + 3;
            font(false, 8.5, COLORS.muted);
            text(detail, x + cellPad, ly, {width: descW});
        }
        x += cols[0].w;
        const cells: Record<string, string> = {
            qty: f.num(line.quantity),
            unit: unitOf(line),
            price: f.money(line.unitPrice),
            total: f.money(lineTotal(line)),
        };
        cols.slice(1).forEach((c) => {
            const v = cells[c.key];
            font(c.key === 'total', 10);
            text(v, x + cellPad, y + cellPad, {
                width: c.w - 2 * cellPad,
                align: c.align,
            });
            x += c.w;
        });
        y += h;
        doc.moveTo(M, y)
            .lineTo(M + CW, y)
            .lineWidth(0.75)
            .strokeColor(COLORS.border)
            .stroke();
    }
    y += 22;

    // ── Bank details (left) and totals (right)
    // Totals take 210 pt on the right; amounts align with the line total column
    const totAreaW = 210;
    const totX = M + CW - totAreaW + cellPad;
    const totRight = M + CW - cellPad;
    const totW = totRight - totX;
    const bankW = CW - totAreaW - 20;
    const bankRows = (
        [
            [t.bankName, field('bank')],
            // Defaults to the name followed by the legal form (e.g. "Jane Doe EI")
            [t.holder, field('account-holder') || [sellerName, field('legal')].filter(Boolean).join(' ')],
            [t.iban, field('iban')],
            [t.bic, field('bic')],
            [t.currency, invoice.currency],
        ] as [string, string][]
    ).filter(([, v]) => v);
    const hasBank = !!field('iban');
    const bankLabelW = 68;
    font(false, 9.5);
    const bankValueW = bankW - 2 * cellPad - bankLabelW;
    const bodyTop = headerH + 10;
    const bankH = hasBank ? bodyTop + bankRows.reduce((s, [, v]) => s + Math.max(height(v, bankValueW), 11) + 4, 0) : 0;
    const totH = 3 * 20 + 30;
    ensure(Math.max(bankH, totH));
    const blockTop = y;

    if (hasBank) {
        drawBand(t.bank, M, bankW);
        let by = y + bodyTop;
        for (const [label, value] of bankRows) {
            font(false, 8.5, COLORS.muted);
            text(label, M + cellPad, by + 0.5, {width: bankLabelW - 6});
            font(false, 9.5);
            text(value, M + cellPad + bankLabelW, by, {width: bankValueW});
            by += Math.max(height(value, bankValueW), 11) + 4;
        }
    }

    const totRow = (label: string, value: string, ty: number) => {
        font(false, 9.5, COLORS.muted);
        text(label, totX, ty, {width: totW / 2});
        font(false, 10);
        text(value, totX, ty, {width: totW, align: 'right'});
    };
    // First total on the same baseline as the bank details title
    const bandBaseline = bandTextY(blockTop) + 9 * GEIST_ASCENT;
    let ty = bandBaseline - 9.5 * GEIST_ASCENT;
    totRow(t.subtotal, f.money(totals.ht), ty);
    ty += 20;
    totRow(`${t.vatLine} (${f.pct(invoice.vatRate)})`, f.money(totals.vat), ty);
    ty += 18;
    doc.moveTo(totX, ty).lineTo(totRight, ty).lineWidth(1).strokeColor(COLORS.ink).stroke();
    ty += 10;
    font('bold', 13);
    text(t.grand, totX, ty, {lineBreak: false});
    text(f.money(totals.ttc), totX, ty, {
        width: totW,
        align: 'right',
        lineBreak: false,
    });
    ty += 22;

    y = Math.max(blockTop + bankH, ty) + 18;

    // ── Terms
    const terms = lines(lang === 'fr' ? invoice.termsFr : invoice.termsEn);
    if (terms.length) {
        font(false, 8.5);
        // Same width as the bank details block, right below it
        const termsW = bankW - 2 * cellPad;
        const bodyH = terms.reduce((s, p) => s + height(p, termsW, {lineGap: 1.5}) + 3, 0);
        ensure(bodyTop + bodyH);
        drawBand(t.terms, M, bankW);
        let py = y + bodyTop;
        font(false, 8.5, '#3a3f4d');
        for (const p of terms) {
            text(p, M + cellPad, py, {width: termsW, lineGap: 1.5});
            py += height(p, termsW, {lineGap: 1.5}) + 3;
        }
    }

    // ── Footer on every page
    const range = doc.bufferedPageRange();
    const footerLeft = [
        sellerName,
        field('siret') && `${t.siret} ${field('siret')}`,
        field('vat') && `${t.vat} ${field('vat')}`,
    ]
        .filter(Boolean)
        .join('  ·  ');
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const fy = PAGE_H - 40;
        doc.moveTo(M, fy - 8)
            .lineTo(M + CW, fy - 8)
            .lineWidth(0.5)
            .strokeColor(COLORS.border)
            .stroke();
        font(false, 7.5, COLORS.muted);
        text(footerLeft, M, fy, {width: CW - 140, lineBreak: false});
        text(`${t.title} ${invoice.number}  ·  ${t.page} ${i + 1}/${range.count}`, M + CW - 200, fy, {
            width: 200,
            align: 'right',
            lineBreak: false,
        });
    }

    doc.end();
    return done;
}
