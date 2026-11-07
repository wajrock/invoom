import { createHash, randomBytes, randomInt } from 'node:crypto';

/** Alphabet de Crockford : sans I, L, O, U pour éviter les confusions à la lecture. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RECOVERY_CODE_COUNT = 10;

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Code de récupération : 16 caractères (80 bits d'aléa), affiché en 4 groupes « XXXX-XXXX-XXXX-XXXX ». */
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

/** Tolère les tirets, espaces, minuscules et les confusions O/0, I/L/1. */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export const hashRecoveryCode = (input: string) => sha256(`recovery:${normalizeRecoveryCode(input)}`);

/** Jeton des liens envoyés par e-mail (inscription, récupération) : 256 bits. */
export const generateEmailToken = () => randomBytes(32).toString('base64url');
export const hashEmailToken = (token: string) => sha256(`email:${token}`);
