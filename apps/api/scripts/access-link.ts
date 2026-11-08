/**
 * Admin tool: one-time access link for an existing account, valid for 30 minutes.
 *
 *   node scripts/access-link.ts --email toi@exemple.fr https://ton-domaine
 *
 * The link creates a passkey on the device that opens it. Last resort for a user with no device,
 * no recovery code and no access to their mailbox, or when SMTP is not configured yet.
 */
import {eq} from 'drizzle-orm';
import {parseArgs} from 'node:util';
import {createDb} from '../src/db/client.ts';
import {emailTokens, users} from '../src/db/schema/index.ts';
import {databaseUrl} from '../src/config/env.ts';
import {generateEmailToken, hashEmailToken} from '../src/modules/auth/tokens.ts';

const {values, positionals} = parseArgs({options: {email: {type: 'string'}}, allowPositionals: true});
const email = values.email?.trim().toLowerCase();
const base = (positionals[0] ?? process.env.APP_URL ?? 'http://localhost:4200').replace(/\/+$/, '');
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^https?:\/\//.test(base)) {
    console.error('Usage : node scripts/access-link.ts --email toi@exemple.fr https://ton-domaine');
    process.exit(1);
}

const {db, sql} = createDb(databaseUrl);
const [user] = await db.select().from(users).where(eq(users.email, email));
if (!user) {
    console.error(`Aucun compte pour ${email} : l'inscription se fait depuis l'application.`);
    await sql.end();
    process.exit(1);
}

const token = generateEmailToken();
const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
await db
    .insert(emailTokens)
    .values({hash: hashEmailToken(token), purpose: 'recover', email, userId: user.id, expiresAt});
await sql.end();

console.log(
    `\nLien d'accès pour ${email} (valable jusqu'à ${expiresAt.toLocaleTimeString('fr-FR')}, usage unique) :\n`,
);
console.log(`  ${base}/login?token=${token}\n`);
console.log("Ouvre-le sur l'appareil à enregistrer (iPhone, Mac…), puis crée la passkey.");
