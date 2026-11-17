/**
 * Local demo mode (`pnpm dev:demo`): a fictitious account, already signed in, with fictitious data, in a database
 * stored in apps/api/.demo. Lets features and fixes be tried on any address (localhost, a tunnel, a phone) without
 * passkeys or access links. Development only: config/env.ts refuses it in production.
 */
import {eq} from 'drizzle-orm';
import type {Hono} from 'hono';
import {fileURLToPath} from 'node:url';
import type {Db} from '../db/client.ts';
import {users, workspaceMembers, workspaces as workspaceTable} from '../db/schema/index.ts';
import type {WorkspaceRuntime} from '../db/workspace-scope.ts';
import {DEFAULT_COMPANY} from '../modules/company/company.defaults.ts';

/** Gitignored; delete it (pnpm demo:reset) to start again from fresh demo data */
export const DEMO_DIR = fileURLToPath(new URL('../../.demo', import.meta.url));

export const DEMO_EMAIL = 'demo@invoom.local';

/** Not a secret: it only protects fictitious data in a local folder */
export const DEMO_ENCRYPTION_KEY = Buffer.alloc(32, 'invoom-demo').toString('base64');

export interface DemoAccount {
    userId: string;
    workspaceId: string;
    /** Created by this start: its data still has to be seeded */
    created: boolean;
}

/** The demo user and its workspace, created on first start. */
export async function ensureDemoAccount(db: Db, workspaces: WorkspaceRuntime): Promise<DemoAccount> {
    const [existing] = await db
        .select({userId: users.id, workspaceId: workspaceMembers.workspaceId})
        .from(users)
        .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
        .where(eq(users.email, DEMO_EMAIL));
    if (existing) return {...existing, created: false};

    return db.transaction(async (tx) => {
        const conn = tx as unknown as Db;
        const [user] = await conn.insert(users).values({email: DEMO_EMAIL}).returning({id: users.id});
        const workspaceId = await workspaces.createWorkspace(conn);
        // Its details are seeded below: skip the first-run setup
        await conn.update(workspaceTable).set({onboarded: true}).where(eq(workspaceTable.id, workspaceId));
        await conn.insert(workspaceMembers).values({workspaceId, userId: user.id});
        return {userId: user.id, workspaceId, created: true};
    });
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 864e5);
const monthStart = (year: number, month: number) => new Date(Date.UTC(year, month, 1));

/**
 * Fills the demo workspace through the API itself, so the data goes through the same validation and encryption
 * as real data. Dates are relative to today, so the dashboard and deadlines always have something to show.
 */
export async function seedDemo(app: Hono) {
    const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
        const res = await app.request(`http://localhost${path}`, {
            method,
            // The API refuses state-changing requests without a same-origin header
            headers: {'content-type': 'application/json', origin: 'http://localhost', host: 'localhost'},
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Démo : ${method} ${path} → ${res.status} ${await res.text()}`);
        return (res.status === 204 ? null : await res.json()) as T;
    };

    const today = new Date();
    const year = today.getUTCFullYear();
    const activityStart = `${year - 1}-01-01`;

    await call('PUT', '/api/settings/tax', {
        activity: 'bnc',
        activityStart,
        cfeExemptFirstYear: true,
        autoDeadlines: true,
        periods: [
            {
                from: activityStart,
                rates: {social: 0.256, vl: 0.022},
                versementLiberatoire: true,
                incomeTaxRate: 0.11,
                declarationFrequency: 'quarterly',
                cfeAmount: 230_00,
                caCeiling: 83_600_00,
                tvaThreshold: 37_500_00,
            },
        ],
    });

    await call('POST', '/api/platforms/suggested');

    const company: Record<string, string> = {
        name: 'Camille Martin',
        legal: 'Entrepreneur individuel',
        siret: '123 456 789 00012',
        siren: '123 456 789',
        ape: '6201Z',
        address: '12 rue des Lilas\n69003 Lyon',
        email: 'camille@exemple.fr',
        phone: '06 12 34 56 78',
        'account-holder': 'Camille Martin',
        iban: 'FR76 3000 6000 0112 3456 7890 189',
        bic: 'AGRIFRPP',
        bank: 'Banque Exemple',
    };
    await call('PUT', '/api/company', {
        fields: DEFAULT_COMPANY.fields.map((f) => ({...f, value: company[f.id] ?? f.value})),
    });

    const clients = [
        {
            name: 'Atelier Lumen',
            countryCode: 'FR',
            address: '8 quai Saint-Antoine\n69002 Lyon',
            country: 'France',
            countryEn: 'France',
            registration: '852 963 741',
            email: 'compta@atelier-lumen.fr',
        },
        {
            name: 'Studio Aurora',
            countryCode: 'IT',
            address: 'Via Roma 21\n20121 Milano (MI)',
            country: 'Italie',
            countryEn: 'Italy',
            vatNumber: 'IT01234567890',
            email: 'amministrazione@studio-aurora.it',
            extra: [{label: 'Codice SdI', value: 'M5UXCR1'}],
            english: true,
        },
        {
            name: 'Nordwind GmbH',
            countryCode: 'DE',
            address: 'Hafenstraße 4\n20457 Hamburg',
            country: 'Allemagne',
            countryEn: 'Germany',
            vatNumber: 'DE123456789',
            email: 'invoices@nordwind.example',
            english: true,
        },
        {
            name: 'Maple & Co',
            countryCode: 'OTHER',
            address: '200 King Street West\nToronto, ON M5H 3T4',
            country: 'Canada',
            countryEn: 'Canada',
            email: 'billing@maple.example',
            english: true,
        },
    ];
    const clientIds: string[] = [];
    for (const c of clients) clientIds.push((await call<{id: string}>('POST', '/api/clients', c)).id);

    const services = [
        {
            label: 'Développement front-end',
            labelEn: 'Front-end development',
            unit: 'jour',
            unitEn: 'day',
            unitPrice: 520_00,
        },
        {label: 'Audit UX/UI', labelEn: 'UX/UI audit', unitPrice: 1_200_00},
        {
            label: 'Maintenance mensuelle',
            labelEn: 'Monthly maintenance',
            unit: 'mois',
            unitEn: 'month',
            unitPrice: 450_00,
            clientId: clientIds[0],
        },
    ];
    for (const s of services) await call('POST', '/api/services', s);

    // About one invoice a month over the last 14 months; the two most recent are still pending
    const plan = [
        {client: 0, service: 0, quantity: 6},
        {client: 1, service: 1, quantity: 1},
        {client: 0, service: 2, quantity: 1},
        {client: 2, service: 0, quantity: 8},
        {client: 3, service: 0, quantity: 4},
        {client: 0, service: 2, quantity: 1},
        {client: 1, service: 0, quantity: 10},
        {client: 2, service: 1, quantity: 1},
        {client: 0, service: 0, quantity: 5},
        {client: 3, service: 0, quantity: 3},
        {client: 1, service: 0, quantity: 7},
        {client: 0, service: 2, quantity: 1},
        {client: 2, service: 0, quantity: 6},
        {client: 1, service: 1, quantity: 1},
    ];
    const numbers = new Map<number, number>();
    const created: {id: string; issuedOn: string; pending: boolean}[] = [];
    for (const [i, p] of plan.entries()) {
        const monthsAgo = plan.length - 1 - i;
        const start = monthStart(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo);
        const day = addDays(start, 27 - monthsAgo);
        const issued = day > today ? today : day;
        const issuedYear = issued.getUTCFullYear();
        const n = (numbers.get(issuedYear) ?? 0) + 1;
        numbers.set(issuedYear, n);
        const service = services[p.service];
        const client = clients[p.client];
        const res = await call<{id: string}>('POST', '/api/invoices', {
            invoice: {
                clientId: clientIds[p.client],
                number: `${issuedYear}-${String(n).padStart(3, '0')}`,
                issuedOn: iso(issued),
                dueOn: iso(addDays(issued, 30)),
                periodFrom: iso(start),
                periodTo: iso(addDays(monthStart(start.getUTCFullYear(), start.getUTCMonth() + 1), -1)),
                english: client.english ?? false,
                lines: [{...service, quantity: p.quantity}],
            },
        });
        created.push({id: res.id, issuedOn: iso(issued), pending: monthsAgo < 2});
    }

    // Mark the older invoices as paid, a couple of weeks after they were issued
    const payments = await call<Record<string, unknown>[]>('GET', '/api/payments');
    for (const c of created.filter((x) => !x.pending)) {
        const payment = payments.find((p) => p.id === c.id);
        if (!payment) continue;
        const paidOn = iso(addDays(new Date(c.issuedOn), 12));
        await call('PUT', `/api/payments/${c.id}`, {...payment, paidOn: paidOn > iso(today) ? iso(today) : paidOn});
    }

    // Declarations already due were made on time: only the coming ones are left to do
    const deadlines = await call<{id: string; dueOn: string}[]>('GET', '/api/deadlines');
    for (const d of deadlines.filter((x) => x.dueOn < iso(today))) {
        await call('PUT', '/api/deadlines/status', {id: d.id, done: true});
    }

    await call('POST', '/api/deadlines', {
        title: 'Renouveler l’assurance RC Pro',
        dueOn: iso(addDays(today, 20)),
        kind: 'autre',
        amount: 380_00,
    });
    await call('POST', '/api/deadlines', {
        title: 'Relancer Studio Aurora',
        dueOn: iso(addDays(today, 5)),
        kind: 'autre',
        note: 'Facture en attente depuis plus de 30 jours',
    });
}
