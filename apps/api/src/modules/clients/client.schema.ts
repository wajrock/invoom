import {z} from 'zod';
import {currencyCode} from '../../core/validation.ts';

export const COUNTRY_CODES = ['FR', 'IT', 'DE', 'OTHER'] as const;

export const clientSchema = z.object({
    name: z.string().trim().min(1).max(200),
    /** Drives which identifiers the client form asks for (SIREN, SdI code…). */
    countryCode: z.enum(COUNTRY_CODES).default('OTHER'),
    address: z.string().max(1000).default(''),
    /** Country as printed on French invoices; `countryEn` is used on English ones. */
    country: z.string().max(100).default(''),
    countryEn: z.string().max(100).default(''),
    /** French SIREN only; foreign identifiers go in `extra`. */
    registration: z.string().max(80).default(''),
    vatNumber: z.string().max(40).default(''),
    email: z.string().max(200).default(''),
    /** Free fields printed on invoices (SdI code, PEC, purchase order…). */
    extra: z
        .array(z.object({label: z.string().trim().min(1).max(60), value: z.string().trim().max(200)}))
        .max(10)
        .default([]),
    english: z.boolean().default(false),
    currency: currencyCode.default('EUR'),
    notes: z.string().max(2000).default(''),
});
export type Client = z.infer<typeof clientSchema>;
