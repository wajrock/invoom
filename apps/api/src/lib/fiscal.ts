/**
 * Calculs fiscaux et sociaux du micro-entrepreneur (régime micro-social).
 *
 * Tous les montants sont en centimes d'euro. Les taux évoluent dans le temps : ils sont
 * stockés sous forme de périodes datées (« à partir du … »), et chaque encaissement est
 * calculé avec la période en vigueur à sa date. Modifier les taux à partir d'une date
 * ne change donc jamais les montants des encaissements antérieurs.
 * Source de référence : https://www.autoentrepreneur.urssaf.fr
 */

export type Activity = 'bnc' | 'bnc_cipav' | 'bic_services' | 'bic_vente';
export type DeclarationFrequency = 'monthly' | 'quarterly';

export interface Rates {
  /** Cotisations sociales */
  social: number;
  /** Versement libératoire de l'impôt sur le revenu */
  vl: number;
}

/** Paramètres applicables à partir d'une date donnée, jusqu'à la période suivante. */
export interface RatePeriod {
  /** Date d'effet (YYYY-MM-DD) */
  from: string;
  rates: Rates;
  versementLiberatoire: boolean;
  /** Taux marginal d'imposition (paramètre annuel), pour estimer l'impôt hors VL */
  incomeTaxRate: number;
  /** Fréquence des déclarations URSSAF (paramètre annuel) */
  declarationFrequency: DeclarationFrequency;
  /** Montant de la CFE, en centimes (paramètre annuel) */
  cfeAmount: number;
  /** Plafond de CA du régime micro, en centimes (paramètre annuel) */
  caCeiling: number;
  /** Seuil de franchise en base de TVA, en centimes (paramètre annuel) */
  tvaThreshold: number;
}

export interface TaxSettings {
  activity: Activity;
  /** Date de début d'activité (YYYY-MM-DD) */
  activityStart: string;
  /** Exonération de CFE l'année de création */
  cfeExemptFirstYear: boolean;
  /** Périodes triées par date d'effet croissante (au moins une) */
  periods: RatePeriod[];
}

export const ACTIVITY_LABELS: Record<Activity, string> = {
  bnc: 'Profession libérale non réglementée (BNC, SSI)',
  bnc_cipav: 'Profession libérale réglementée (BNC, CIPAV)',
  bic_services: 'Prestations de services commerciales/artisanales (BIC)',
  bic_vente: 'Vente de marchandises (BIC)',
};

/** Abattement forfaitaire pour frais, utilisé pour estimer le revenu imposable. */
export const ABATTEMENT: Record<Activity, number> = {
  bnc: 0.34,
  bnc_cipav: 0.34,
  bic_services: 0.5,
  bic_vente: 0.71,
};

export function defaultRates(activity: Activity): Rates {
  switch (activity) {
    case 'bnc':
      return { social: 0.261, vl: 0.022 };
    case 'bnc_cipav':
      return { social: 0.232, vl: 0.022 };
    case 'bic_services':
      return { social: 0.212, vl: 0.017 };
    case 'bic_vente':
      return { social: 0.123, vl: 0.01 };
  }
}

export function defaultCeilings(activity: Activity): { caCeiling: number; tvaThreshold: number } {
  return activity === 'bic_vente'
    ? { caCeiling: 188_700_00, tvaThreshold: 85_000_00 }
    : { caCeiling: 77_700_00, tvaThreshold: 37_500_00 };
}

export function defaultPeriod(activity: Activity, from: string): RatePeriod {
  return {
    from,
    rates: defaultRates(activity),
    versementLiberatoire: false,
    incomeTaxRate: 0.11,
    declarationFrequency: 'quarterly',
    cfeAmount: 0,
    ...defaultCeilings(activity),
  };
}

export function defaultTaxSettings(today = new Date()): TaxSettings {
  const activityStart = `${today.getUTCFullYear()}-01-01`;
  return {
    activity: 'bnc',
    activityStart,
    cfeExemptFirstYear: true,
    periods: [defaultPeriod('bnc', activityStart)],
  };
}

/** Ancien format (une seule série de taux, sans date) : conservé pour la migration. */
interface LegacyTaxSettings extends Omit<RatePeriod, 'from'> {
  activity: Activity;
  activityStart: string;
  cfeExemptFirstYear: boolean;
}

/** Convertit d'anciens paramètres en une première période couvrant tout l'historique. */
export function normalizeTaxSettings(raw: TaxSettings | LegacyTaxSettings): TaxSettings {
  const cleanRates = (r: Rates): Rates => ({ social: r.social, vl: r.vl });
  if ('periods' in raw && Array.isArray(raw.periods)) {
    // On ne garde que les champs utilisés (les anciens réglages contenaient ACRE, CFP, chambre)
    const periods = raw.periods.map((p) => ({
      from: p.from,
      rates: cleanRates(p.rates),
      versementLiberatoire: p.versementLiberatoire,
      incomeTaxRate: p.incomeTaxRate,
      declarationFrequency: p.declarationFrequency,
      cfeAmount: p.cfeAmount,
      caCeiling: p.caCeiling,
      tvaThreshold: p.tvaThreshold,
    }));
    return {
      activity: raw.activity,
      activityStart: raw.activityStart,
      cfeExemptFirstYear: raw.cfeExemptFirstYear,
      periods: sortPeriods(periods),
    };
  }
  const old = raw as LegacyTaxSettings;
  return {
    activity: old.activity,
    activityStart: old.activityStart,
    cfeExemptFirstYear: old.cfeExemptFirstYear,
    periods: [
      {
        from: old.activityStart,
        rates: cleanRates(old.rates),
        versementLiberatoire: old.versementLiberatoire,
        incomeTaxRate: old.incomeTaxRate,
        declarationFrequency: old.declarationFrequency,
        cfeAmount: old.cfeAmount,
        caCeiling: old.caCeiling,
        tvaThreshold: old.tvaThreshold,
      },
    ],
  };
}

export function sortPeriods(periods: RatePeriod[]): RatePeriod[] {
  return [...periods].sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Période en vigueur à une date. Avant la première date d'effet, la première
 * période s'applique (elle couvre tout l'historique antérieur).
 */
export function periodAt(s: TaxSettings, date: string): RatePeriod {
  let current = s.periods[0];
  for (const p of s.periods) {
    if (p.from <= date) current = p;
    else break;
  }
  return current;
}

/** Paramètres annuels d'une année : ceux en vigueur au 31 décembre. */
export function annualPeriod(s: TaxSettings, year: number): RatePeriod {
  return periodAt(s, `${year}-12-31`);
}

// ---------------------------------------------------------------------------
// Dates (chaînes ISO YYYY-MM-DD, calculs en UTC pour éviter les décalages)
// ---------------------------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Dernier jour du mois (month0 : 0-11, peut déborder sur l'année suivante). */
export function lastDayOfMonth(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0 + 1, 0));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function firstDayOfMonth(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
}

/** Dimanche de Pâques (algorithme de Meeus/Butcher), au format YYYY-MM-DD. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Jours fériés nationaux (France métropolitaine). */
export function frenchHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const plus = (days: number) => iso(new Date(easter.getTime() + days * 864e5));
  return new Set([
    `${year}-01-01`,
    plus(1), // lundi de Pâques
    `${year}-05-01`,
    `${year}-05-08`,
    plus(39), // Ascension
    plus(50), // lundi de Pentecôte
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ]);
}

/** Reporte une date au premier jour ouvré (ni samedi, ni dimanche, ni férié). */
export function nextBusinessDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  for (;;) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6 && !frenchHolidays(d.getUTCFullYear()).has(iso(d))) return iso(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

// ---------------------------------------------------------------------------
// Charges
// ---------------------------------------------------------------------------

export interface Encaissement {
  /** Montant encaissé en centimes d'euro */
  amount: number;
  /** Date d'encaissement (YYYY-MM-DD) */
  paidOn: string;
}

export interface Charges {
  ca: number;
  social: number;
  vl: number;
  /** Total à payer à l'URSSAF (cotisations + VL) */
  urssaf: number;
  /** Part de CA encaissée sous versement libératoire */
  caUnderVl: number;
}

/** Chaque encaissement est calculé avec la période en vigueur à sa date. */
export function computeCharges(items: Encaissement[], s: TaxSettings): Charges {
  let ca = 0;
  let caUnderVl = 0;
  let social = 0;
  let vl = 0;
  for (const p of items) {
    const period = periodAt(s, p.paidOn);
    ca += p.amount;
    // Taux saisi par l'utilisateur, appliqué tel quel (ACRE incluse s'il y a lieu)
    social += p.amount * period.rates.social;
    if (period.versementLiberatoire) {
      caUnderVl += p.amount;
      vl += p.amount * period.rates.vl;
    }
  }
  const r = Math.round;
  const res = { ca, caUnderVl, social: r(social), vl: r(vl) };
  return { ...res, urssaf: res.social + res.vl };
}

export interface YearSummary extends Charges {
  year: number;
  /** Impôt sur le revenu estimé sur le CA hors VL (CA abattu × TMI de l'année) */
  incomeTaxEstimate: number;
  cfe: number;
  cfeExempt: boolean;
  /** Ce qu'il reste après URSSAF (VL inclus), impôt et CFE */
  net: number;
}

export function isCfeExempt(year: number, s: TaxSettings): boolean {
  const startYear = Number(s.activityStart.slice(0, 4));
  return year < startYear || (s.cfeExemptFirstYear && year === startYear);
}

export function computeYear(year: number, items: Encaissement[], s: TaxSettings): YearSummary {
  const inYear = items.filter((p) => p.paidOn.startsWith(`${year}-`));
  const charges = computeCharges(inYear, s);
  const annual = annualPeriod(s, year);
  const incomeTaxEstimate = Math.round(
    (charges.ca - charges.caUnderVl) * (1 - ABATTEMENT[s.activity]) * annual.incomeTaxRate,
  );
  const cfeExempt = isCfeExempt(year, s);
  const cfe = cfeExempt ? 0 : annual.cfeAmount;
  return {
    ...charges,
    year,
    incomeTaxEstimate,
    cfe,
    cfeExempt,
    net: charges.ca - charges.urssaf - incomeTaxEstimate - cfe,
  };
}

// ---------------------------------------------------------------------------
// Échéances générées automatiquement
// ---------------------------------------------------------------------------

export type DeadlineKind = 'urssaf' | 'cfe' | 'impot' | 'autre';

export interface AutoDeadline {
  autoKey: string;
  kind: DeadlineKind;
  title: string;
  dueOn: string;
  /** Montant estimé en centimes (null si inconnu) */
  amount: number | null;
  /** Période couverte (pour l'URSSAF) */
  periodStart?: string;
  periodEnd?: string;
  note?: string;
}

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
/** Centimes → "5 000,00 €" */
const eur = (cents: number) => EUR.format(cents / 100);

/** "2026-10-01" → "1 octobre 2026" */
function frDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MONTHS_FR[m - 1]} ${y}`;
}

/**
 * Fin de la période couverte par la première déclaration URSSAF.
 * Règle : la 1re déclaration intervient à l'issue du trimestre (ou du mois) qui suit
 * le 90e jour d'activité, et couvre toute la période depuis le début d'activité.
 * Ex. début le 1er oct. 2026 (trimestriel) : 90e jour fin déc. → période jusqu'au 31 mars 2027.
 */
export function firstDeclarationEnd(s: TaxSettings): string {
  const [y, m, d] = s.activityStart.split('-').map(Number);
  const day90 = new Date(Date.UTC(y, m - 1, d + 90));
  const year = day90.getUTCFullYear();
  const month0 = day90.getUTCMonth();
  const startYear = Number(s.activityStart.slice(0, 4));
  if (annualPeriod(s, startYear).declarationFrequency === 'monthly') return lastDayOfMonth(year, month0 + 1);
  const quarter = Math.floor(month0 / 3);
  return lastDayOfMonth(year, (quarter + 1) * 3 + 2);
}

export function generateDeadlines(years: number[], items: Encaissement[], s: TaxSettings): AutoDeadline[] {
  const out: AutoDeadline[] = [];
  const startYear = Number(s.activityStart.slice(0, 4));

  const sumBetween = (from: string, to: string) =>
    computeCharges(items.filter((p) => p.paidOn >= from && p.paidOn <= to), s);

  const firstEnd = firstDeclarationEnd(s);

  for (const year of years) {
    if (year < startYear) continue;
    const annual = annualPeriod(s, year);

    // Déclarations URSSAF (CA + cotisations, et VL si activé)
    const monthly = annual.declarationFrequency === 'monthly';
    const count = monthly ? 12 : 4;
    for (let i = 0; i < count; i++) {
      const periodStart = monthly ? firstDayOfMonth(year, i) : firstDayOfMonth(year, i * 3);
      const periodEnd = monthly ? lastDayOfMonth(year, i) : lastDayOfMonth(year, i * 3 + 2);
      // Périodes antérieures à la fin de la 1re déclaration : regroupées dans celle-ci
      if (periodEnd < firstEnd) continue;
      const isFirst = periodEnd === firstEnd;
      const from = isFirst ? s.activityStart : periodStart;
      const c = sumBetween(from, periodEnd);
      // Élision devant voyelle : « d'avril », « d'août », « d'octobre »
      const de = /^[aeiouéèâ]/i.test(MONTHS_FR[i]) ? 'd’' : 'de ';
      const label = monthly ? `${de}${MONTHS_FR[i]} ${year}` : `du T${i + 1} ${year}`;
      out.push({
        autoKey: monthly ? `urssaf:${year}-${pad(i + 1)}` : `urssaf:${year}-Q${i + 1}`,
        kind: 'urssaf',
        title: isFirst
          ? `Première déclaration URSSAF (du ${frDate(s.activityStart)} au ${frDate(periodEnd)})`
          : `Déclaration URSSAF ${label}`,
        // Échéance reportée au jour ouvré suivant (week-end, jour férié), comme le fait l'URSSAF
        dueOn: nextBusinessDay(monthly ? lastDayOfMonth(year, i + 1) : lastDayOfMonth(year, i * 3 + 3)),
        amount: c.urssaf,
        periodStart: from,
        periodEnd,
        note: isFirst
          ? `CA à déclarer : ${eur(c.ca)}. La 1re déclaration couvre toute la période depuis le début d’activité (règle des 90 jours) : vérifie la date sur ton espace URSSAF.`
          : `CA à déclarer : ${eur(c.ca)}`,
      });
    }

    // CFE : déclaration initiale l'année de création, paiement le 15 décembre ensuite
    if (year === startYear) {
      out.push({
        autoKey: `cfe-decl:${year}`,
        kind: 'cfe',
        title: 'Déclaration initiale CFE (formulaire 1447-C-SD)',
        dueOn: `${year}-12-31`,
        amount: null,
        note: 'À faire sur impots.gouv.fr (espace professionnel) l’année de création.',
      });
    }
    if (!isCfeExempt(year, s)) {
      out.push({
        autoKey: `cfe:${year}`,
        kind: 'cfe',
        title: `Paiement CFE ${year}`,
        dueOn: `${year}-12-15`,
        amount: annual.cfeAmount || null,
        note: 'Avis disponible dans l’espace professionnel impots.gouv.fr (mi-novembre).',
      });
    }

    // Déclaration de revenus (CA de l'année précédente sur la 2042-C-PRO)
    if (year - 1 >= startYear) {
      const prev = computeYear(year - 1, items, s);
      const allUnderVl = prev.ca > 0 && prev.caUnderVl === prev.ca;
      const partlyUnderVl = prev.caUnderVl > 0 && !allUnderVl;
      out.push({
        autoKey: `ir:${year}`,
        kind: 'impot',
        title: `Déclaration de revenus ${year} (CA ${year - 1})`,
        dueOn: `${year}-05-31`,
        amount: allUnderVl ? null : prev.incomeTaxEstimate,
        note: `Déclarer ${eur(prev.ca)} de CA sur la 2042-C-PRO. Date limite exacte selon votre département (fin mai / début juin).${
          allUnderVl ? ' Impôt déjà payé via le versement libératoire.' : ''
        }${
          partlyUnderVl
            ? ` Dont ${eur(prev.caUnderVl)} sous versement libératoire (impôt déjà payé sur cette part).`
            : ''
        }`,
      });
    }
  }

  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}
