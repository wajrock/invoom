import {integer, pgTable, primaryKey, text, timestamp, uuid} from 'drizzle-orm/pg-core';
import {bytea} from './columns.ts';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Lower-case, verified at sign-up. */
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Business data belongs to a workspace rather than a user, so members can be invited later. */
export const workspaces = pgTable('workspaces', {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Workspace data key, encrypted with the master key. */
    dataKey: bytea('data_key').notNull(),
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

export const passkeys = pgTable('passkeys', {
    /** Credential id (base64url) chosen by the authenticator. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {onDelete: 'cascade'}),
    publicKey: bytea('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    /** Comma-separated transports (internal, hybrid…). */
    transports: text('transports').notNull().default(''),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', {withTimezone: true}),
});

/** One-time codes, stored as SHA-256; 80 random bits each makes them globally unique. */
export const recoveryCodes = pgTable('recovery_codes', {
    hash: text('hash').primaryKey(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {onDelete: 'cascade'}),
    usedAt: timestamp('used_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** One-time links sent by email for sign-up or account recovery. */
export const emailTokens = pgTable('email_tokens', {
    hash: text('hash').primaryKey(),
    purpose: text('purpose', {enum: ['signup', 'recover']}).notNull(),
    email: text('email').notNull(),
    /** Null for a sign-up: the account does not exist yet. */
    userId: uuid('user_id').references(() => users.id, {onDelete: 'cascade'}),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
    usedAt: timestamp('used_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Pending WebAuthn challenges (single use, a few minutes). */
export const authChallenges = pgTable('auth_challenges', {
    id: text('id').primaryKey(),
    challenge: text('challenge').notNull(),
    kind: text('kind', {enum: ['login', 'register']}).notNull(),
    /** Registration: the account that will own the passkey (new or existing). */
    userId: uuid('user_id'),
    /** Registration through an email link: the token consumed on success. */
    emailTokenHash: text('email_token_hash'),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
});

export const sessions = pgTable('sessions', {
    /** SHA-256 of the session token; the token itself is never stored. */
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

/** Brute-force and email throttling counters, keyed by IP, address or "*" (global). */
export const loginAttempts = pgTable('login_attempts', {
    key: text('key').primaryKey(),
    failures: integer('failures').notNull().default(0),
    lockouts: integer('lockouts').notNull().default(0),
    lockedUntil: timestamp('locked_until', {withTimezone: true}),
    windowStart: timestamp('window_start', {withTimezone: true}).notNull().defaultNow(),
});
