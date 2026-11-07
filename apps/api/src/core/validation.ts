import {z} from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');
export const currencyCode = z.string().regex(/^[A-Z]{3}$/);
/** Amount in cents, capped at one billion euros. */
export const cents = z.number().int().min(0).max(100_000_000_00);
