import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {isoDate} from '../../core/validation.ts';
import {clientSchema} from '../clients/client.schema.ts';
import {deadlineSchema} from '../deadlines/deadline.schema.ts';
import {serviceSchema} from '../services/service.schema.ts';
import {type ApiCall, changesOf, destructive, id, patcher, readOnly, text, write} from './mcp.shared.ts';

/** Clients, saved services and deadlines: list, create, update, delete */
export function registerRecordTools(server: McpServer, api: ApiCall) {
    const patch = patcher(api);
    const crud = (
        kind: {single: string; plural: string; path: string; titles: [string, string, string, string]},
        schema: z.ZodObject,
    ) => {
        const [listT, createT, updateT, deleteT] = kind.titles;
        server.registerTool(
            `list_${kind.plural}`,
            {title: listT, description: listT, annotations: readOnly},
            async () => text(await api('GET', kind.path)),
        );
        server.registerTool(
            `create_${kind.single}`,
            {title: createT, description: createT, inputSchema: schema.shape, annotations: write},
            async (body) => text(await api('POST', kind.path, body)),
        );
        server.registerTool(
            `update_${kind.single}`,
            {
                title: updateT,
                description: `${updateT} : seuls les champs fournis changent.`,
                inputSchema: {id, ...changesOf(schema)},
                annotations: write,
            },
            async ({id: recordId, ...changes}) => text(await patch(kind.path, recordId as string, changes)),
        );
        server.registerTool(
            `delete_${kind.single}`,
            {title: deleteT, description: deleteT, inputSchema: {id}, annotations: destructive},
            async ({id: recordId}) =>
                text(await api('DELETE', `${kind.path}/${recordId}`).then(() => ({deleted: recordId}))),
        );
    };
    crud(
        {
            single: 'client',
            plural: 'clients',
            path: '/api/clients',
            titles: ['Clients', 'Créer un client', 'Modifier un client', 'Supprimer un client'],
        },
        clientSchema,
    );
    crud(
        {
            single: 'service',
            plural: 'services',
            path: '/api/services',
            titles: [
                'Prestations enregistrées',
                'Créer une prestation',
                'Modifier une prestation',
                'Supprimer une prestation',
            ],
        },
        serviceSchema,
    );

    server.registerTool(
        'list_deadlines',
        {
            title: 'Échéances',
            description: 'Déclarations URSSAF, CFE, impôt (calculées) et rappels, avec leur statut.',
            inputSchema: {from: isoDate.optional(), to: isoDate.optional()},
            annotations: readOnly,
        },
        async ({from, to}) => {
            const q = new URLSearchParams({...(from && {from}), ...(to && {to})});
            return text(await api('GET', `/api/deadlines${q.size ? `?${q}` : ''}`));
        },
    );
    server.registerTool(
        'create_deadline',
        {
            title: 'Créer un rappel',
            description: 'Ajoute une échéance personnalisée (rappel).',
            inputSchema: deadlineSchema.shape,
            annotations: write,
        },
        async (body) => text(await api('POST', '/api/deadlines', body)),
    );
    server.registerTool(
        'update_deadline',
        {
            title: 'Modifier un rappel',
            description:
                'Modifie un rappel (les échéances calculées ne se modifient pas) : seuls les champs fournis changent.',
            inputSchema: {id, ...changesOf(deadlineSchema)},
            annotations: write,
        },
        async ({id: deadlineId, ...changes}) => text(await patch('/api/deadlines', deadlineId, changes)),
    );
    server.registerTool(
        'set_deadline_done',
        {
            title: 'Marquer une échéance',
            description: 'Marque une échéance (calculée ou rappel) comme effectuée ou non.',
            inputSchema: {id: z.string().max(100).describe('Identifiant (list_deadlines)'), done: z.boolean()},
            annotations: write,
        },
        async (body) => text(await api('PUT', '/api/deadlines/status', body)),
    );
    server.registerTool(
        'delete_deadline',
        {
            title: 'Supprimer une échéance',
            description: 'Supprime un rappel, ou masque définitivement une échéance calculée.',
            inputSchema: {id: z.string().max(100).describe('Identifiant (list_deadlines)')},
            annotations: destructive,
        },
        async ({id: deadlineId}) =>
            text(
                await api('DELETE', `/api/deadlines/${encodeURIComponent(deadlineId)}`).then(() => ({
                    deleted: deadlineId,
                })),
            ),
    );
}
