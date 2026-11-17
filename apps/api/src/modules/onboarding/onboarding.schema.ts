import {z} from 'zod';
import {isoDate} from '../../core/validation.ts';

const text = (max: number) => z.string().trim().max(max);

/** SIRET checksum (Luhn); La Poste's establishments use a digit sum that is a multiple of 5 instead */
function validSiret(siret: string): boolean {
    const digits = [...siret].map(Number);
    if (siret.startsWith('356000000')) return digits.reduce((s, d) => s + d, 0) % 5 === 0;
    const sum = digits.reverse().reduce((s, d, i) => s + (i % 2 ? (d * 2 > 9 ? d * 2 - 9 : d * 2) : d), 0);
    return sum % 10 === 0;
}

const required = (max: number, message: string) => text(max).min(1, message);

/** First-run setup: what invoices cannot do without, the bank details included (payment by transfer) */
export const onboardingSchema = z.object({
    company: z.object({
        name: required(200, 'Le nom est requis'),
        legal: required(120, 'La forme juridique est requise'),
        siret: z
            .string()
            .transform((s) => s.replace(/\s/g, ''))
            .refine((s) => /^\d{14}$/.test(s) && validSiret(s), 'Ce SIRET n’est pas valide'),
        address: required(500, 'L’adresse est requise'),
        email: z.email('E-mail invalide').max(254),
        phone: text(40).default(''),
        iban: required(50, 'L’IBAN est requis'),
        bic: text(20).default(''),
        bank: required(120, 'Le nom de la banque est requis'),
        accountHolder: required(200, 'Le titulaire du compte est requis'),
    }),
    tax: z.object({
        activity: z.enum(['bnc', 'bnc_cipav', 'bic_services', 'bic_vente']),
        activityStart: isoDate,
        versementLiberatoire: z.boolean().default(false),
    }),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;
