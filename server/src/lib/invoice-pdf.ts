import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { invoiceTotals, lineTotal } from './invoice.ts';
import type { Client, Company, Invoice } from './types.ts';

export type InvoiceLang = 'fr' | 'en';

const LABELS = {
  fr: {
    title: 'Facture',
    issuedOn: 'Émise le',
    dueOn: 'Échéance le',
    period: 'Prestation',
    legal: 'Forme',
    siret: 'SIRET',
    reg: 'SIREN',
    vat: 'N° TVA',
    email: 'E-mail',
    phone: 'Téléphone',
    desc: 'Désignation',
    qty: 'Qté',
    unit: 'Unité',
    price: 'Prix u. HT',
    total: 'Total HT',
    subtotal: 'Total HT',
    vatLine: 'TVA',
    grand: 'Total TTC',
    bank: 'Coordonnées bancaires',
    bankName: 'Banque',
    holder: 'Titulaire',
    iban: 'IBAN',
    bic: 'BIC',
    currency: 'Devise',
    terms: 'Conditions et mentions légales',
    page: 'Page',
  },
  en: {
    title: 'Invoice',
    issuedOn: 'Issued',
    dueOn: 'Due',
    period: 'Service period',
    legal: 'Legal form',
    siret: 'SIRET',
    reg: 'SIREN',
    vat: 'VAT ID',
    email: 'Email',
    phone: 'Phone',
    desc: 'Service and description',
    qty: 'Qty',
    unit: 'Unit',
    price: 'Unit price',
    total: 'Amount',
    subtotal: 'Subtotal',
    vatLine: 'VAT',
    grand: 'Total',
    bank: 'Bank details',
    bankName: 'Bank',
    holder: 'Account holder',
    iban: 'IBAN',
    bic: 'BIC / SWIFT',
    currency: 'Currency',
    terms: 'Terms and conditions',
    page: 'Page',
  },
} as const;

const C = {
  ink: '#1f2330',
  muted: '#6b7080',
  accent: '#4338ca',
  /** Version pastel de l'accent (≈ 14 % sur blanc) pour les bandes secondaires */
  accentSoft: '#e6e4f8',
  soft: '#f5f6f9',
  border: '#e2e4ea',
  white: '#ffffff',
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;
const CW = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - 56;

/** Police Geist (SIL OFL, voir assets/fonts/Geist-OFL.txt), embarquée dans chaque PDF. */
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
const FONT_FILES: Record<Weight, string> = {
  regular: 'Geist-Regular.ttf',
  medium: 'Geist-Medium.ttf',
  semibold: 'Geist-SemiBold.ttf',
  bold: 'Geist-Bold.ttf',
};
const FONTS = Object.fromEntries(
  Object.entries(FONT_FILES).map(([w, file]) => [w, readFileSync(new URL(`../../assets/fonts/${file}`, import.meta.url))]),
) as Record<Weight, Buffer>;

/** Métriques verticales de Geist (en em), pour centrer un texte dans une bande */
const GEIST_ASCENT = 1.005;
const GEIST_CAP = 0.71;

/** Espaces fines (séparateur de milliers fr-FR) → espace insécable, présente dans toutes les polices. */
function safe(s: string): string {
  return s.replace(/[\u202f\u2009\u2007]/g, '\u00a0').replace(/[\u2010\u2011]/g, '-');
}

function formatters(lang: InvoiceLang, currency: string) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const enDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return {
    money: (cents: number) => money.format(cents / 100),
    num: (n: number) => num.format(n),
    pct: (r: number) => (lang === 'fr' ? `${num.format(r * 100)} %` : `${num.format(r * 100)}%`),
    date: (iso: string) => {
      const [y, m, d] = iso.split('-');
      return lang === 'fr' ? `${d}/${m}/${y}` : enDate.format(new Date(Date.UTC(+y, +m - 1, +d)));
    },
  };
}

export interface RenderInput {
  invoice: Invoice;
  client: Client;
  company: Company;
  lang: InvoiceLang;
}

export function renderInvoicePdf({ invoice, client, company, lang }: RenderInput): Promise<Buffer> {
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
  /** true = semi-gras (intitulés), false = normal */
  const font = (weight: boolean | Weight, size: number, color = C.ink) =>
    doc
      .font(weight === true ? 'semibold' : weight === false ? 'regular' : weight)
      .fontSize(size)
      .fillColor(color);
  // Sans ligatures (tt, fi…) : sinon le texte copié ou indexé perd des lettres (« Cete » au lieu de « Cette »)
  const noLig = { features: { liga: false, clig: false, dlig: false } as unknown as PDFKit.Mixins.OpenTypeFeatures[] };
  const text = (s: string, x: number, y: number, opts: PDFKit.Mixins.TextOptions = {}) =>
    doc.text(safe(s), x, y, { ...noLig, ...opts });
  const height = (s: string, width: number, opts: PDFKit.Mixins.TextOptions = {}) =>
    doc.heightOfString(safe(s), { width, ...noLig, ...opts });

  let y = M;
  const ensure = (h: number) => {
    if (y + h <= BOTTOM) return false;
    doc.addPage();
    y = M;
    return true;
  };

  // ── Blocs d'identité (sans cadre), dessinés sous le titre ───────────────────
  type Party = { name: string; lines: string[]; rows: [string, string][] };
  const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  // Forme courte (EI, EURL…) accolée au nom, comme l'exige la mention « EI » ; sinon sur sa propre ligne
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
  // Le pays n'est pas ajouté : il figure en général déjà dans l'adresse saisie
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
  /** Interligne des blocs émetteur / client */
  const PARTY_GAP = 5;
  const sep = lang === 'fr' ? '\u00a0: ' : ': ';
  /** Dessine un bloc d'identité et renvoie sa hauteur */
  const drawParty = (p: Party, x: number, align: 'left' | 'right') => {
    let py = y;
    font('semibold', 12);
    text(p.name, x, py, { width: colW, align });
    // Nom collé à l'adresse : ils forment un seul groupe
    py += height(p.name, colW) + 2;
    font(false, 9.5);
    for (const l of p.lines) {
      text(l, x, py, { width: colW, align });
      py += height(l, colW) + PARTY_GAP;
    }
    if (p.rows.length) py += PARTY_GAP + 3;
    for (const [label, value] of p.rows) {
      // Libellé en gris, valeur en noir, sur la même ligne (positions mesurées : « continued » ne gère pas l'alignement à droite)
      font(false, 9.5);
      const lw = doc.widthOfString(safe(label + sep), noLig);
      const vw = doc.widthOfString(safe(value), noLig);
      if (lw + vw <= colW) {
        const lx = align === 'right' ? x + colW - lw - vw : x;
        font(false, 9.5, C.muted);
        text(label + sep, lx, py, { lineBreak: false });
        font(false, 9.5);
        text(value, lx + lw, py, { lineBreak: false });
        py += height(value, colW) + PARTY_GAP;
      } else {
        // Valeur trop longue : libellé puis valeur sur sa propre ligne
        font(false, 9.5, C.muted);
        text(label, x, py, { width: colW, align });
        py += height(label, colW) + 1;
        font(false, 9.5);
        text(value, x, py, { width: colW, align });
        py += height(value, colW) + PARTY_GAP;
      }
    }
    return py - y;
  };
  // ── Titre et dates ──────────────────────────────────────────────────────────
  // Titre complet dans la couleur principale
  font('bold', 22, C.accent);
  text(`${t.title} #${invoice.number.replace(/^#/, '')}`, M, y, { lineBreak: false });
  y += 32;
  font(false, 9.5, C.muted);
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
  // Date de réalisation de la prestation : mention obligatoire quand elle diffère de la date de facture
  if (period) {
    text(`${t.period} ${period}`, M, y);
    y += 15;
  }
  y += 26;

  // ── Émetteur à gauche, client à droite ────────────────────────────────────
  const partyH = Math.max(drawParty(seller, M, 'left'), drawParty(buyer, M + CW - colW, 'right'));
  y += partyH + 28;

  // ── Lignes de facture ───────────────────────────────────────────────────────
  const unitOf = (l: (typeof invoice.lines)[number]) => (lang === 'en' ? l.unitEn || l.unit : l.unit) ?? '';
  // L'unité est optionnelle : sans aucune unité renseignée, la colonne disparaît au profit de la désignation
  const hasUnit = invoice.lines.some((l) => unitOf(l).trim());
  const cols = [
    { key: 'desc', w: hasUnit ? 214 : 289, align: 'left' as const },
    { key: 'qty', w: 40, align: 'right' as const },
    ...(hasUnit ? [{ key: 'unit', w: 75, align: 'left' as const }] : []),
    { key: 'price', w: 80, align: 'right' as const },
    { key: 'total', w: 90, align: 'right' as const },
  ];
  const cellPad = 10;
  const headerH = 26;
  /** Ordonnée du texte centré dans une bande colorée : milieu des majuscules au milieu de la bande */
  const bandTextY = (top: number) => top + headerH / 2 - 9 * (GEIST_ASCENT - GEIST_CAP / 2);
  /** Bande de titre des blocs secondaires : même forme que l'en-tête du tableau, en pastel */
  const drawBand = (title: string, x: number, w: number) => {
    doc.roundedRect(x, y, w, headerH, 6).fill(C.accentSoft);
    font('medium', 9, C.accent);
    text(title, x + cellPad, bandTextY(y), { width: w - 2 * cellPad, lineBreak: false });
  };
  const drawHeader = () => {
    doc.roundedRect(M, y, CW, headerH, 6).fill(C.accent);
    font('medium', 9, C.white);
    const ty = bandTextY(y);
    let x = M;
    for (const c of cols) {
      text(t[c.key as keyof typeof t], x + cellPad, ty, { width: c.w - 2 * cellPad, align: c.align, lineBreak: false });
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
    text(label, x + cellPad, y + cellPad, { width: descW });
    if (detail) {
      const ly = y + cellPad + height(label, descW) + 3;
      font(false, 8.5, C.muted);
      text(detail, x + cellPad, ly, { width: descW });
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
      text(v, x + cellPad, y + cellPad, { width: c.w - 2 * cellPad, align: c.align });
      x += c.w;
    });
    y += h;
    doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.75).strokeColor(C.border).stroke();
  }
  y += 22;

  // ── Coordonnées bancaires (gauche) et totaux (droite) ──────────────────────
  // Zone des totaux de 210 pt à droite ; montants alignés à droite sur ceux de la colonne « Total HT »
  const totAreaW = 210;
  const totX = M + CW - totAreaW + cellPad;
  const totRight = M + CW - cellPad;
  const totW = totRight - totX;
  const bankW = CW - totAreaW - 20;
  const bankRows = (
    [
      [t.bankName, field('bank')],
      // À défaut, le nom suivi de la forme juridique (ex. « Thibaud Wajrock EI »)
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
  const bankH = hasBank
    ? bodyTop + bankRows.reduce((s, [, v]) => s + Math.max(height(v, bankValueW), 11) + 4, 0)
    : 0;
  const totH = 3 * 20 + 30;
  ensure(Math.max(bankH, totH));
  const blockTop = y;

  if (hasBank) {
    drawBand(t.bank, M, bankW);
    let by = y + bodyTop;
    for (const [label, value] of bankRows) {
      font(false, 8.5, C.muted);
      text(label, M + cellPad, by + 0.5, { width: bankLabelW - 6 });
      font(false, 9.5);
      text(value, M + cellPad + bankLabelW, by, { width: bankValueW });
      by += Math.max(height(value, bankValueW), 11) + 4;
    }
  }

  const totRow = (label: string, value: string, ty: number) => {
    font(false, 9.5, C.muted);
    text(label, totX, ty, { width: totW / 2 });
    font(false, 10);
    text(value, totX, ty, { width: totW, align: 'right' });
  };
  // « Total HT » sur la même ligne de base que le titre « Coordonnées bancaires » (9 pt dans la bande)
  const bandBaseline = bandTextY(blockTop) + 9 * GEIST_ASCENT;
  let ty = bandBaseline - 9.5 * GEIST_ASCENT;
  totRow(t.subtotal, f.money(totals.ht), ty);
  ty += 20;
  totRow(`${t.vatLine} (${f.pct(invoice.vatRate)})`, f.money(totals.vat), ty);
  ty += 18;
  doc.moveTo(totX, ty).lineTo(totRight, ty).lineWidth(1).strokeColor(C.ink).stroke();
  ty += 10;
  font('bold', 13);
  text(t.grand, totX, ty, { lineBreak: false });
  text(f.money(totals.ttc), totX, ty, { width: totW, align: 'right', lineBreak: false });
  ty += 22;

  y = Math.max(blockTop + bankH, ty) + 18;

  // ── Mentions ────────────────────────────────────────────────────────────────
  const terms = lines(lang === 'fr' ? invoice.termsFr : invoice.termsEn);
  if (terms.length) {
    font(false, 8.5);
    // Même largeur que le bloc des coordonnées bancaires, aligné dessous
    const termsW = bankW - 2 * cellPad;
    const bodyH = terms.reduce((s, p) => s + height(p, termsW, { lineGap: 1.5 }) + 3, 0);
    ensure(bodyTop + bodyH);
    drawBand(t.terms, M, bankW);
    let py = y + bodyTop;
    font(false, 8.5, '#3a3f4d');
    for (const p of terms) {
      text(p, M + cellPad, py, { width: termsW, lineGap: 1.5 });
      py += height(p, termsW, { lineGap: 1.5 }) + 3;
    }
  }

  // ── Pied de page sur chaque page ───────────────────────────────────────────
  const range = doc.bufferedPageRange();
  const footerLeft = [
    [sellerName, field('legal')].filter(Boolean).join(' '),
    field('siret') && `${t.siret} ${field('siret')}`,
    field('vat') && `${t.vat} ${field('vat')}`,
  ]
    .filter(Boolean)
    .join('  ·  ');
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const fy = PAGE_H - 40;
    doc.moveTo(M, fy - 8).lineTo(M + CW, fy - 8).lineWidth(0.5).strokeColor(C.border).stroke();
    font(false, 7.5, C.muted);
    text(footerLeft, M, fy, { width: CW - 140, lineBreak: false });
    text(`${t.title} ${invoice.number}  ·  ${t.page} ${i + 1}/${range.count}`, M + CW - 200, fy, {
      width: 200,
      align: 'right',
      lineBreak: false,
    });
  }

  doc.end();
  return done;
}
