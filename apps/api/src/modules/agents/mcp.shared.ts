import {z} from 'zod';

/** Calls the business API as the connected agent: same validation, encryption and workspace isolation. */
export type ApiCall = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;

export const text = (value: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(value, null, 2)}]});
export const id = z.uuid().describe('Identifiant');
/**
 * Fields of an update: all optional and without their defaults, so a field the agent leaves out keeps its value
 * (a default would overwrite it).
 */
export function changesOf(schema: z.ZodObject): z.ZodRawShape {
    return Object.fromEntries(
        Object.entries(schema.shape).map(([key, field]) => [
            key,
            (field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : (field as z.ZodType)).optional(),
        ]),
    );
}

export const readOnly = {readOnlyHint: true, openWorldHint: false};
export const write = {readOnlyHint: false, destructiveHint: false, openWorldHint: false};
export const destructive = {readOnlyHint: false, destructiveHint: true, openWorldHint: false};

/** PUT routes take the whole record: the change is merged into the current one */
export function patcher(api: ApiCall) {
    return async (path: string, recordId: string, changes: Record<string, unknown>) => {
        const rows = await api<{id: string}[]>('GET', path);
        const current = rows.find((r) => r.id === recordId);
        if (!current) throw new Error('Introuvable');
        const given = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
        return api('PUT', `${path}/${recordId}`, {...current, ...given});
    };
}
