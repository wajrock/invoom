import {z} from 'zod';
import {isoDate} from '../../core/validation.ts';

export const deadlineSchema = z.object({
    title: z.string().min(1).max(200),
    dueOn: isoDate,
    kind: z.enum(['urssaf', 'cfe', 'impot', 'autre']).default('autre'),
    amount: z.number().int().min(0).nullable().default(null),
    note: z.string().max(2000).default(''),
});
export type CustomDeadline = z.infer<typeof deadlineSchema>;
