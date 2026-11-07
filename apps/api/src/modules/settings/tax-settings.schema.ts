import {z} from 'zod';
import {isoDate} from '../../core/validation.ts';

const ratePeriodSchema = z.object({
    from: isoDate,
    rates: z.object({
        social: z.number().min(0).max(1),
        vl: z.number().min(0).max(1),
    }),
    versementLiberatoire: z.boolean(),
    incomeTaxRate: z.number().min(0).max(1),
    declarationFrequency: z.enum(['monthly', 'quarterly']),
    cfeAmount: z.number().int().min(0),
    caCeiling: z.number().int().min(0),
    tvaThreshold: z.number().int().min(0),
});

export const taxSettingsSchema = z.object({
    activity: z.enum(['bnc', 'bnc_cipav', 'bic_services', 'bic_vente']),
    activityStart: isoDate,
    cfeExemptFirstYear: z.boolean(),
    periods: z
        .array(ratePeriodSchema)
        .min(1, 'Au moins une période de taux est requise')
        .max(100)
        .refine((ps) => new Set(ps.map((p) => p.from)).size === ps.length, 'Deux périodes ont la même date d’effet'),
});
