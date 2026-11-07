import {z} from 'zod';

/** Shape check only: the WebAuthn library performs the real verification. */
export const credentialJson = z.looseObject({
    id: z.string().min(1).max(1024),
    rawId: z.string(),
    type: z.literal('public-key'),
    response: z.looseObject({}),
});

export const emailBody = z.object({
    email: z
        .email('Adresse e-mail invalide')
        .max(254)
        .transform((v) => v.trim().toLowerCase()),
});
