import { customType, date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Colonne binaire : toutes les données métier y sont stockées chiffrées (AES-256-GCM). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/** Paramètres clé/valeur chiffrés : "company" (infos entreprise), "tax" (paramètres fiscaux). */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  data: bytea('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const platforms = pgTable('platforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  position: integer('position').notNull().default(0),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Carnet de clients réutilisables pour les factures (coordonnées chiffrées). */
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Catalogue de prestations réutilisables comme lignes de facture (données chiffrées). */
export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Un paiement = un encaissement, qui regroupe sa facture FR et sa facture EN. */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issuedOn: date('issued_on').notNull(),
    paidOn: date('paid_on'),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('payments_paid_on_idx').on(t.paidOn)],
);

export const invoiceFiles = pgTable('invoice_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id, { onDelete: 'cascade' }),
  lang: text('lang', { enum: ['fr', 'en', 'other'] }).notNull(),
  /** Métadonnées chiffrées : nom, type MIME, taille */
  meta: bytea('meta').notNull(),
  /** Contenu du fichier chiffré */
  content: bytea('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Échéances personnalisées (autoKey null) et statut "payé" des échéances
 * générées automatiquement (autoKey = identifiant de la période, ex. "urssaf:2026-Q3").
 */
export const deadlines = pgTable('deadlines', {
  id: uuid('id').primaryKey().defaultRandom(),
  autoKey: text('auto_key').unique(),
  dueOn: date('due_on').notNull(),
  doneAt: timestamp('done_at', { withTimezone: true }),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  /** SHA-256 du jeton de session (le jeton lui-même n'est jamais stocké) */
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Anti brute-force : un enregistrement par IP + un compteur global ("*"). */
export const loginAttempts = pgTable('login_attempts', {
  key: text('key').primaryKey(),
  failures: integer('failures').notNull().default(0),
  lockouts: integer('lockouts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
});
