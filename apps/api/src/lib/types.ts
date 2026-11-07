import { z } from 'zod';

export const companyFieldSchema = z.object({
  id: z.string().min(1).max(64),
  group: z.string().max(80).default('Général'),
  label: z.string().min(1).max(120),
  value: z.string().max(4000).default(''),
});
export const companySchema = z.object({ fields: z.array(companyFieldSchema).max(200) });
export type Company = z.infer<typeof companySchema>;

export const platformSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.url({ protocol: /^https?$/ }).max(2000),
  category: z.string().max(80).default('Autre'),
  description: z.string().max(500).default(''),
  /** Identifiant / e-mail de connexion (jamais le mot de passe) */
  login: z.string().max(200).default(''),
});
export type Platform = z.infer<typeof platformSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');
const currency = z.string().regex(/^[A-Z]{3}$/);

export const COUNTRY_CODES = ['FR', 'IT', 'DE', 'OTHER'] as const;

export const clientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** Pays du client : détermine les champs demandés dans la fiche (SIREN, Code SdI…) */
  countryCode: z.enum(COUNTRY_CODES).default('OTHER'),
  /** Adresse complète, sur plusieurs lignes */
  address: z.string().max(1000).default(''),
  /** Pays, tel qu'il doit apparaître sur la facture FR (ex. « Italie ») */
  country: z.string().max(100).default(''),
  /** Pays sur la facture EN (ex. « Italy ») ; à défaut, celui de la facture FR */
  countryEn: z.string().max(100).default(''),
  /** SIREN, pour un client français uniquement (identifiants étrangers : voir `extra`) */
  registration: z.string().max(80).default(''),
  vatNumber: z.string().max(40).default(''),
  email: z.string().max(200).default(''),
  /** Champs libres imprimés sur la facture (Code SdI, PEC, n° de bon de commande…) */
  extra: z
    .array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().max(200) }))
    .max(10)
    .default([]),
  /** Générer aussi la facture anglaise par défaut */
  english: z.boolean().default(false),
  currency: currency.default('EUR'),
  notes: z.string().max(2000).default(''),
});
export type Client = z.infer<typeof clientSchema>;

const invoiceLineSchema = z.object({
  label: z.string().trim().min(1).max(200),
  labelEn: z.string().trim().max(200).default(''),
  detail: z.string().trim().max(500).default(''),
  detailEn: z.string().trim().max(500).default(''),
  unit: z.string().trim().max(40).default(''),
  unitEn: z.string().trim().max(40).default(''),
  /** Quantité, jusqu'à 2 décimales (ex. 2,5 jours) */
  quantity: z.number().positive().max(1_000_000),
  /** Prix unitaire HT, en centimes de la devise de la facture */
  unitPrice: z.number().int().min(0).max(100_000_000_00),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

/** Prestation du catalogue : une ligne de facture prête à l'emploi (sans quantité) */
export const serviceSchema = invoiceLineSchema.omit({ quantity: true }).extend({
  /** Client auquel la prestation est réservée (null = proposée pour tous les clients) */
  clientId: z.uuid().nullable().default(null),
});
export type Service = z.infer<typeof serviceSchema>;

/** Mentions par défaut des factures, modifiables par facture. */
export const invoiceSettingsSchema = z.object({
  paymentDays: z.number().int().min(0).max(120),
  termsFr: z.string().max(4000),
  termsEn: z.string().max(4000),
});
export type InvoiceSettings = z.infer<typeof invoiceSettingsSchema>;

/** Contenu d'une facture : une seule saisie, rendue en FR (toujours) et en EN (option). */
export const invoiceSchema = z
  .object({
    clientId: z.uuid(),
    number: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(
        /^#?[A-Za-z0-9](?:[A-Za-z0-9_\-/.]*[A-Za-z0-9])?$/,
        'Lettres, chiffres et séparateurs - / . _ (commence et finit par une lettre ou un chiffre)',
      )
      .refine((n) => !/[-/._]{2}/.test(n), 'Séparateurs consécutifs interdits'),
    issuedOn: isoDate,
    dueOn: isoDate,
    periodFrom: isoDate.nullable().default(null),
    periodTo: isoDate.nullable().default(null),
    currency: currency.default('EUR'),
    /** Taux de TVA (0 en franchise en base) */
    vatRate: z.number().min(0).max(1).default(0),
    lines: z.array(invoiceLineSchema).min(1, 'Au moins une ligne').max(30),
    english: z.boolean().default(false),
    termsFr: z.string().max(4000).default(''),
    termsEn: z.string().max(4000).default(''),
  })
  .refine((i) => i.dueOn >= i.issuedOn, { message: "L'échéance précède la date de facture", path: ['dueOn'] })
  .refine((i) => !i.periodFrom || !i.periodTo || i.periodFrom <= i.periodTo, {
    message: 'Période de prestation invalide',
    path: ['periodTo'],
  });
export type Invoice = z.infer<typeof invoiceSchema>;

/** Facture telle que stockée avec son paiement : le client est figé au moment de l'émission. */
export type StoredInvoice = Invoice & { client: Client; generatedAt: string };

export const paymentSchema = z.object({
  /** Client du carnet (le nom reste copié dans `client` pour l'historique) */
  clientId: z.uuid().nullable().default(null),
  client: z.string().min(1).max(200),
  label: z.string().max(500).default(''),
  invoiceNumber: z.string().max(80).default(''),
  issuedOn: isoDate,
  paidOn: isoDate.nullable().default(null),
  /** Montant encaissé en euros, en centimes : c'est lui qui compte pour le CA */
  amount: z.number().int().min(0).max(100_000_000_00),
  /** Montant facturé dans la devise d'origine (facture anglaise), en centimes */
  originalAmount: z.number().int().min(0).max(100_000_000_00).nullable().default(null),
  originalCurrency: currency.default('EUR'),
  notes: z.string().max(4000).default(''),
});
export type Payment = z.infer<typeof paymentSchema>;
/** Données chiffrées d'un paiement (les dates sont en clair pour le tri/filtrage). */
export type PaymentData = Omit<Payment, 'issuedOn' | 'paidOn'> & {
  /** Présent si la facture a été générée par l'application */
  invoice?: StoredInvoice | null;
};

export const deadlineSchema = z.object({
  title: z.string().min(1).max(200),
  dueOn: isoDate,
  kind: z.enum(['urssaf', 'cfe', 'impot', 'autre']).default('autre'),
  amount: z.number().int().min(0).nullable().default(null),
  note: z.string().max(2000).default(''),
});
export type CustomDeadline = z.infer<typeof deadlineSchema>;

const ratePeriodSchema = z.object({
  from: isoDate,
  rates: z.object({
    social: z.number().min(0).max(1),
    vl: z.number().min(0).max(1),
  }),
  versementLiberatoire: z.boolean(),
  incomeTaxRate: z.number().min(0).max(1),
  declarationFrequency: z.enum(['monthly', 'quarterly']),
  cfeAmount: z.number().int().min(0),
  caCeiling: z.number().int().min(0),
  tvaThreshold: z.number().int().min(0),
});

export const taxSettingsSchema = z.object({
  activity: z.enum(['bnc', 'bnc_cipav', 'bic_services', 'bic_vente']),
  activityStart: isoDate,
  cfeExemptFirstYear: z.boolean(),
  periods: z
    .array(ratePeriodSchema)
    .min(1, 'Au moins une période de taux est requise')
    .max(100)
    .refine((ps) => new Set(ps.map((p) => p.from)).size === ps.length, 'Deux périodes ont la même date d’effet'),
});
