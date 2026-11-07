import {createHash, randomBytes, randomInt} from 'node:crypto';

/** Crockford alphabet: no I, L, O or U, so codes can't be misread. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RECOVERY_CODE_COUNT = 10;

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** 16 characters (80 random bits), shown as XXXX-XXXX-XXXX-XXXX. */
export function generateRecoveryCode(): string {
    let raw = '';
    for (let i = 0; i < 16; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
    return raw.match(/.{4}/g)!.join('-');
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
    const codes = new Set<string>();
    while (codes.size < count) codes.add(generateRecoveryCode());
    return [...codes];
}

/** Accepts dashes, spaces, lower case and the O/0 and I/L/1 confusions. */
export function normalizeRecoveryCode(input: string): string {
    return input
        .toUpperCase()
        .replace(/[^0-9A-Z]/g, '')
        .replace(/O/g, '0')
        .replace(/[IL]/g, '1');
}

export const hashRecoveryCode = (input: string) => sha256(`recovery:${normalizeRecoveryCode(input)}`);

/** Sign-up and recovery links: 256 random bits. */
export const generateEmailToken = () => randomBytes(32).toString('base64url');
export const hashEmailToken = (token: string) => sha256(`email:${token}`);
