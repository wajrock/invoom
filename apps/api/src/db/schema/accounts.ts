import {boolean, integer, pgTable, primaryKey, text, timestamp, uuid} from 'drizzle-orm/pg-core';
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
    /** The owner went through the first-run setup (business details, activity); the app requires it */
    onboarded: boolean('onboarded').notNull().default(false),
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

/**
 * Agents (MCP clients such as Claude) connected through OAuth 2.1. They register themselves (dynamic client
 * registration), the user approves them once, and they keep access until the connection is revoked.
 */
export const oauthClients = pgTable('oauth_clients', {
    /** Random public identifier; agents are public clients (PKCE, no secret). */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    redirectUris: text('redirect_uris').array().notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Authorization codes: SHA-256, single use, a few minutes. */
export const oauthCodes = pgTable('oauth_codes', {
    hash: text('hash').primaryKey(),
    clientId: text('client_id')
        .notNull()
        .references(() => oauthClients.id, {onDelete: 'cascade'}),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {onDelete: 'cascade'}),
    workspaceId: uuid('workspace_id')
        .notNull()
        .references(() => workspaces.id, {onDelete: 'cascade'}),
    redirectUri: text('redirect_uri').notNull(),
    codeChallenge: text('code_challenge').notNull(),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
});

/**
 * An agent's access to a workspace, approved by the user. It lasts until revoked: the refresh token has no expiry
 * and rotates on every use (the previous one is kept to detect a replayed, stolen token).
 */
export const agentConnections = pgTable('agent_connections', {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: text('client_id')
        .notNull()
        .references(() => oauthClients.id, {onDelete: 'cascade'}),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, {onDelete: 'cascade'}),
    workspaceId: uuid('workspace_id')
        .notNull()
        .references(() => workspaces.id, {onDelete: 'cascade'}),
    /** SHA-256 of the current refresh token */
    refreshHash: text('refresh_hash').notNull().unique(),
    previousRefreshHash: text('previous_refresh_hash').unique(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', {withTimezone: true}).notNull().defaultNow(),
});

/** Short-lived access tokens (SHA-256) of a connection; revoking it deletes them. */
export const agentTokens = pgTable('agent_tokens', {
    hash: text('hash').primaryKey(),
    connectionId: uuid('connection_id')
        .notNull()
        .references(() => agentConnections.id, {onDelete: 'cascade'}),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
});
