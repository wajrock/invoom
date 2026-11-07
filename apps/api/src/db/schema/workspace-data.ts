import {sql} from 'drizzle-orm';
import {date, index, integer, pgTable, primaryKey, text, timestamp, unique, uuid} from 'drizzle-orm/pg-core';
import {workspaces} from './accounts.ts';
import {bytea} from './columns.ts';

/** Workspace that received the data created before accounts existed. */
export const LEGACY_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Every business row belongs to a workspace. Isolation is enforced by Postgres row-level security
 * (see migration 0003); workspace_id defaults to the workspace set on the request transaction.
 */
const workspaceId = () =>
    uuid('workspace_id')
        .notNull()
        .default(sql`nullif(current_setting('app.workspace_id', true), '')::uuid`)
        .references(() => workspaces.id, {onDelete: 'cascade'});

/** Encrypted key/value settings: "company", "tax", "invoice". */
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

export const clients = pgTable('clients', {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

export const services = pgTable('services', {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: workspaceId(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/** One payment groups its French and English invoice PDFs. */
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
    meta: bytea('meta').notNull(),
    content: bytea('content').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
});

/**
 * Custom deadlines (autoKey null) and the "done" status of generated ones
 * (autoKey = period id, e.g. "urssaf:2026-Q3").
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

/** Tables protected by row-level security; the restricted app role is granted access to these only. */
export const WORKSPACE_TABLES = [
    'settings',
    'platforms',
    'clients',
    'services',
    'payments',
    'invoice_files',
    'deadlines',
] as const;
