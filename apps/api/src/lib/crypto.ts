import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';

/**
 * AES-256-GCM. Format : [version 1 octet][iv 12 octets][tag 16 octets][données chiffrées]
 */
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

export function createCipher(keyBase64: string) {
    const key = Buffer.from(keyBase64, 'base64');
    if (key.length !== 32) throw new Error('La clé de chiffrement doit faire 32 octets');

    function encrypt(plain: Buffer): Buffer {
        const iv = randomBytes(IV_LEN);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        const data = Buffer.concat([cipher.update(plain), cipher.final()]);
        return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), data]);
    }

    function decrypt(payload: Buffer): Buffer {
        if (payload[0] !== VERSION) throw new Error('Version de chiffrement inconnue');
        const iv = payload.subarray(1, 1 + IV_LEN);
        const tag = payload.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
        const data = payload.subarray(1 + IV_LEN + TAG_LEN);
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]);
    }

    return {
        encrypt,
        decrypt,
        encryptJson: (value: unknown) => encrypt(Buffer.from(JSON.stringify(value), 'utf8')),
        decryptJson: <T>(payload: Buffer): T => JSON.parse(decrypt(payload).toString('utf8')) as T,
    };
}

export type Cipher = ReturnType<typeof createCipher>;
