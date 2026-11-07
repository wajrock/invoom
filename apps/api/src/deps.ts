import type { Db } from './db/client.ts';
import type { Cipher } from './lib/crypto.ts';

export interface Deps {
  db: Db;
  cipher: Cipher;
}
