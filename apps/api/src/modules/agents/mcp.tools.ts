import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {isoDate} from '../../core/validation.ts';
import {invoiceLineSchema} from '../invoices/invoice.schema.ts';
import {expectedIncome, invoicePlan, type PaymentRow} from './mcp.data.ts';
import {registerRecordTools} from './mcp.records.ts';
import {type ApiCall, destructive, id, patcher, readOnly, text, write} from './mcp.shared.ts';

const INSTRUCTIONS = `Invoom : back-office d'un micro-entrepreneur français (factures, clients, paiements, échéances fiscales).
- Montants en centimes d'euro (123456 = 1 234,56 €), dates au format AAAA-MM-JJ.
- Réponds à l'utilisateur en français.
- Avant de créer une facture, appelle create_invoice sans confirm pour montrer l'aperçu (numéro, client, total), et ne confirme qu'avec l'accord explicite de l'utilisateur : un numéro de facture émis ne se réutilise pas.
- Les suppressions sont définitives : demande confirmation avant.`;

export function createMcpServer(api: ApiCall) {
    const server = new McpServer({name: 'invoom', version: '1.0.0'}, {instructions: INSTRUCTIONS});

    const patch = patcher(api);

    // ------------------------------------------------------------------ Activité
    server.registerTool(
        'get_company',
        {
            title: 'Infos entreprise',
            description: 'Identité, coordonnées et banque de l’entreprise.',
            annotations: readOnly,
        },
        async () => {
            const company = await api<{fields: {label: string; value: string}[]}>('GET', '/api/company');
            return text(Object.fromEntries(company.fields.filter((f) => f.value).map((f) => [f.label, f.value])));
        },
    );
    server.registerTool(
        'get_tax_settings',
        {
            title: 'Paramètres fiscaux',
            description: 'Activité, taux de cotisations et de versement libératoire par période, CFE, plafonds.',
            annotations: readOnly,
        },
        async () => text(await api('GET', '/api/settings/tax')),
    );
    server.registerTool(
        'get_overview',
        {
            title: 'Résumé de l’année',
            description:
                'CA encaissé, cotisations URSSAF, impôts, net estimé, encaissements par mois, seuils (TVA, plafond micro) et prochaines échéances.',
            inputSchema: {year: z.number().int().min(2000).max(2100).optional().describe('Année (défaut : en cours)')},
            annotations: readOnly,
        },
        async ({year}) => text(await api('GET', `/api/dashboard?year=${year ?? new Date().getFullYear()}`)),
    );
    server.registerTool(
        'get_expected_income',
        {
            title: 'Encaissements attendus',
            description:
                'Factures non payées dont l’échéance tombe dans le mois demandé (défaut : mois prochain), et factures en retard.',
            inputSchema: {
                month: z
                    .string()
                    .regex(/^\d{4}-\d{2}$/)
                    .optional()
                    .describe('Mois AAAA-MM'),
            },
            annotations: readOnly,
        },
        async ({month}) => text(expectedIncome(await api<PaymentRow[]>('GET', '/api/payments'), month)),
    );
    server.registerTool(
        'simulate',
        {
            title: 'Simulateur',
            description:
                'Avec les taux enregistrés : net en poche pour un montant facturé (from=gross), ou montant à facturer pour un net voulu (from=net).',
            inputSchema: {
                amount: z.number().int().min(0).describe('Montant en centimes'),
                from: z.enum(['gross', 'net']).default('gross'),
            },
            annotations: readOnly,
        },
        async ({amount, from}) => text(await api('GET', `/api/simulator?amount=${amount}&from=${from}`)),
    );

    // ------------------------------------------------------------------ Paiements et factures
    server.registerTool(
        'list_payments',
        {
            title: 'Paiements',
            description: 'Factures et paiements, du plus récent au plus ancien, avec filtres.',
            inputSchema: {
                year: z.number().int().optional().describe('Année d’émission'),
                status: z.enum(['paid', 'pending']).optional(),
                client: z.string().optional().describe('Nom du client (recherche partielle)'),
            },
            annotations: readOnly,
        },
        async ({year, status, client}) => {
            const rows = await api<PaymentRow[]>('GET', '/api/payments');
            const q = client?.toLowerCase();
            return text(
                rows
                    .filter((p) => !year || p.issuedOn.startsWith(String(year)))
                    .filter((p) => !status || (status === 'paid') === Boolean(p.paidOn))
                    .filter((p) => !q || p.client.toLowerCase().includes(q))
                    .map(({invoice, files, ...p}) => ({
                        ...p,
                        dueOn: invoice?.dueOn ?? null,
                        files: files?.length ?? 0,
                    })),
            );
        },
    );
    server.registerTool(
        'get_payment',
        {
            title: 'Détail d’un paiement',
            description: 'Paiement et sa facture (lignes, client, conditions).',
            inputSchema: {id},
            annotations: readOnly,
        },
        async ({id: paymentId}) => {
            const p = (await api<PaymentRow[]>('GET', '/api/payments')).find((r) => r.id === paymentId);
            if (!p) throw new Error('Paiement introuvable');
            return text(p);
        },
    );
    server.registerTool(
        'create_invoice',
        {
            title: 'Créer une facture',
            description:
                'Crée une facture (PDF généré) et le paiement en attente associé, ou remplace la facture d’un paiement existant (paymentId). Sans confirm : aperçu seulement.',
            inputSchema: {
                clientId: id.describe('Client facturé (list_clients)'),
                lines: z.array(invoiceLineSchema).min(1).max(30).describe('Lignes ; unitPrice en centimes HT'),
                issuedOn: isoDate.optional().describe('Date d’émission (défaut : aujourd’hui)'),
                paymentDays: z.number().int().min(0).max(120).optional().describe('Délai de paiement en jours'),
                periodFrom: isoDate.optional(),
                periodTo: isoDate.optional(),
                english: z.boolean().optional().describe('Version anglaise en plus (défaut : selon le client)'),
                eurAmount: z.number().int().optional().describe('Montant reçu en centimes d’euro, facture en devise'),
                paymentId: id.optional().describe('Paiement dont la facture est remplacée'),
                confirm: z.boolean().default(false).describe('true pour créer réellement la facture'),
            },
            annotations: write,
        },
        async (input) => {
            const plan = await invoicePlan(api, input);
            if (!input.confirm) return text({preview: true, ...plan.summary});
            const saved = await api('POST', '/api/invoices', plan.request);
            return text({created: true, ...plan.summary, payment: saved});
        },
    );
    server.registerTool(
        'update_payment',
        {
            title: 'Modifier un paiement',
            description:
                'Date d’encaissement (null = en attente), libellé ou notes. Le contenu de la facture se change avec create_invoice et paymentId.',
            inputSchema: {
                id,
                paidOn: isoDate.nullable().optional().describe('Date d’encaissement, null pour « en attente »'),
                label: z.string().max(500).optional(),
                notes: z.string().max(4000).optional(),
            },
            annotations: write,
        },
        async ({id: paymentId, ...changes}) => text(await patch('/api/payments', paymentId, changes)),
    );
    server.registerTool(
        'delete_payment',
        {
            title: 'Supprimer un paiement',
            description: 'Supprime le paiement et ses factures PDF.',
            inputSchema: {id},
            annotations: destructive,
        },
        async ({id: paymentId}) =>
            text(await api('DELETE', `/api/payments/${paymentId}`).then(() => ({deleted: paymentId}))),
    );

    registerRecordTools(server, api);
    return server;
}
