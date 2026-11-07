import type {Db} from '../db/client.ts';
import type {Cipher} from './crypto.ts';

export interface Deps {
    db: Db;
    cipher: Cipher;
}
