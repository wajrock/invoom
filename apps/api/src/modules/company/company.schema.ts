import {z} from 'zod';

export const companyFieldSchema = z.object({
    id: z.string().min(1).max(64),
    group: z.string().max(80).default('Général'),
    label: z.string().min(1).max(120),
    value: z.string().max(4000).default(''),
});

export const companySchema = z.object({fields: z.array(companyFieldSchema).max(200)});
export type Company = z.infer<typeof companySchema>;
