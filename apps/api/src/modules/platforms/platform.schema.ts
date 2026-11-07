import {z} from 'zod';

export const platformSchema = z.object({
    name: z.string().min(1).max(120),
    url: z.url({protocol: /^https?$/}).max(2000),
    category: z.string().max(80).default('Autre'),
    description: z.string().max(500).default(''),
    /** Login identifier only: passwords are never stored. */
    login: z.string().max(200).default(''),
});
export type Platform = z.infer<typeof platformSchema>;
