import { hash } from '@node-rs/argon2';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question("Code d'accès à hasher : ")).trim();
rl.close();
if (code.length < 6) {
  console.error('Le code doit faire au moins 6 caractères (une phrase de passe est recommandée).');
  process.exit(1);
}
console.log('\nACCESS_CODE_HASH=' + (await hash(code)));
