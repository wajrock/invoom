import {sql} from 'drizzle-orm';
import {
    customType,
    date,
    index,
    integer,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
    uuid,
} from 'drizzle-orm/pg-core';

/** Colonne binaire : toutes les données métier y sont stockées chiffrées (AES-256-GCM). */
const bytea = customType<{data: Buffer; driverData: Buffer}>({dataType: () => 'bytea'});

/** Espace fixe qui reçoit les données créées avant le passage en multi-utilisateur. */
export const LEGACY_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Adresse e-mail en minuscules, vérifiée à l'inscription */
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/**
 * Espace de travail : toutes les données métier lui appartiennent (et non à une personne),
 * pour pouvoir y inviter plus tard un comptable ou un associé.
 */
export const workspaces = pgTable('workspaces', {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Clé de données propre à l'espace, chiffrée par la clé maîtresse (null = espace historique, clé maîtresse) */
    dataKey: bytea('data_key'),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
    'workspace_members',
    {
        workspaceId: uuid('workspace_id')
            .notNull()
            .references(() => workspaces.id, {onDelete: 'cascade'}),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, {onDelete: 'cascade'}),
        role: text('role', {enum: ['owner', 'member']})
            .notNull()
            .default('owner'),
        createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    },
    (t) => [primaryKey({columns: [t.workspaceId, t.userId]})],
);

/** Passkeys (WebAuthn) : seul moyen de connexion courant. La clé publique n'est pas secrète. */
export const passkeys = pgTable('passkeys', {
    /** Identifiant de la credential (base64url), fourni par l'authentificateur */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {onDelete: 'cascade'}),
    publicKey: bytea('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    /** Transports annoncés (internal, hybrid…), séparés par des virgules */
    transports: text('transports').notNull().default(''),
    /** Nom choisi pour l'appareil ("iPhone", "MacBook"…) */
    name: text('name').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', {withTimezone: true}),
});

/** Codes de récupération à usage unique (SHA-256 ; 80 bits d'aléa chacun, donc uniques globalement). */
export const recoveryCodes = pgTable('recovery_codes', {
    hash: text('hash').primaryKey(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {onDelete: 'cascade'}),
    usedAt: timestamp('used_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Liens envoyés par e-mail : création de compte ou récupération (ajout d'une passkey). Usage unique. */
export const emailTokens = pgTable('email_tokens', {
    /** SHA-256 du jeton */
    hash: text('hash').primaryKey(),
    purpose: text('purpose', {enum: ['signup', 'recover']}).notNull(),
    email: text('email').notNull(),
    /** Compte concerné (récupération) ; null pour une inscription */
    userId: uuid('user_id').references(() => users.id, {onDelete: 'cascade'}),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
    usedAt: timestamp('used_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Défis WebAuthn en attente (usage unique, quelques minutes). */
export const authChallenges = pgTable('auth_challenges', {
    id: text('id').primaryKey(),
    challenge: text('challenge').notNull(),
    kind: text('kind', {enum: ['login', 'register']}).notNull(),
    /** Inscription : compte qui recevra la passkey (nouveau ou existant) */
    userId: uuid('user_id'),
    /** Inscription via un lien e-mail : jeton consommé à la validation */
    emailTokenHash: text('email_token_hash'),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
});

export const sessions = pgTable('sessions', {
    /** SHA-256 du jeton de session (le jeton lui-même n'est jamais stocké) */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {onDelete: 'cascade'}),
    workspaceId: uuid('workspace_id')
        .notNull()
        .references(() => workspaces.id, {onDelete: 'cascade'}),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Anti brute-force et limites d'envoi : un compteur par clé (IP, e-mail, "*" global…). */
export const loginAttempts = pgTable('login_attempts', {
    key: text('key').primaryKey(),
    failures: integer('failures').notNull().default(0),
    lockouts: integer('lockouts').notNull().default(0),
    lockedUntil: timestamp('locked_until', {withTimezone: true}),
    windowStart: timestamp('window_start', {withTimezone: true}).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Données métier : chaque ligne appartient à un espace.
// L'isolation est garantie par Postgres (Row-Level Security, voir la migration 0003) :
// workspace_id est rempli automatiquement depuis le contexte de la requête.
// ---------------------------------------------------------------------------

const workspaceId = () =>
    uuid('workspace_id')
        .notNull()
        .default(sql`nullif(current_setting('app.workspace_id', true), '')::uuid`)
        .references(() => workspaces.id, {onDelete: 'cascade'});

/** Paramètres clé/valeur chiffrés : "company" (infos entreprise), "tax" (paramètres fiscaux), "invoice". */
export const settings = pgTable(
    'settings',
    {
        workspaceId: workspaceId(),
        key: text('key').notNull(),
        data: bytea('data').notNull(),
        updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
    },
    (t) => [primaryKey({columns: [t.workspaceId, t.key]})],
);

export const platforms = pgTable('platforms', {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    position: integer('position').notNull().default(0),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Carnet de clients réutilisables pour les factures (coordonnées chiffrées). */
export const clients = pgTable('clients', {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Catalogue de prestations réutilisables comme lignes de facture (données chiffrées). */
export const services = pgTable('services', {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Un paiement = un encaissement, qui regroupe sa facture FR et sa facture EN. */
export const payments = pgTable(
    'payments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        workspaceId: workspaceId(),
        issuedOn: date('issued_on').notNull(),
        paidOn: date('paid_on'),
        data: bytea('data').notNull(),
        createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    },
    (t) => [index('payments_paid_on_idx').on(t.paidOn), index('payments_workspace_idx').on(t.workspaceId)],
);

export const invoiceFiles = pgTable('invoice_files', {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    paymentId: uuid('payment_id')
        .notNull()
        .references(() => payments.id, {onDelete: 'cascade'}),
    lang: text('lang', {enum: ['fr', 'en', 'other']}).notNull(),
    /** Métadonnées chiffrées : nom, type MIME, taille */
    meta: bytea('meta').notNull(),
    /** Contenu du fichier chiffré */
    content: bytea('content').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/**
 * Échéances personnalisées (autoKey null) et statut "payé" des échéances
 * générées automatiquement (autoKey = identifiant de la période, ex. "urssaf:2026-Q3").
 */
export const deadlines = pgTable(
    'deadlines',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        workspaceId: workspaceId(),
        autoKey: text('auto_key'),
        dueOn: date('due_on').notNull(),
        doneAt: timestamp('done_at', {withTimezone: true}),
        data: bytea('data').notNull(),
        createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    },
    (t) => [unique('deadlines_workspace_auto_key').on(t.workspaceId, t.autoKey)],
);

/** Tables isolées par espace (Row-Level Security). */
export const WORKSPACE_TABLES = [
    'settings',
    'platforms',
    'clients',
    'services',
    'payments',
    'invoice_files',
    'deadlines',
] as const;
