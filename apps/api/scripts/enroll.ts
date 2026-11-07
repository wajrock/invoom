/**
 * Admin tool: one-time access link for an account, valid for 30 minutes.
 *
 *   node scripts/enroll.ts --email toi@exemple.fr https://ton-domaine
 *
 * - Creates the account if needed.
 * - If the legacy workspace (data from before accounts existed) has no owner yet, attaches it to
 *   this account: this is how the original owner gets their data back after the migration.
 * - Prints a link that creates a passkey on the device that opens it.
 *
 * Also a last resort for a user with no device, no recovery code and no access to their mailbox.
 */
import {eq, inArray, sql as dsql} from 'drizzle-orm';
import {parseArgs} from 'node:util';
import {createDb} from '../src/db/client.ts';
import {
    emailTokens,
    LEGACY_WORKSPACE_ID,
    users,
    WORKSPACE_TABLES,
    workspaceMembers,
    workspaces,
} from '../src/db/schema/index.ts';
import {databaseUrl} from '../src/config/env.ts';
import {generateEmailToken, hashEmailToken} from '../src/modules/auth/tokens.ts';

const {values, positionals} = parseArgs({options: {email: {type: 'string'}}, allowPositionals: true});
const email = values.email?.trim().toLowerCase();
const base = (positionals[0] ?? process.env.APP_URL ?? 'http://localhost:4200').replace(/\/+$/, '');
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^https?:\/\//.test(base)) {
    console.error('Usage : node scripts/enroll.ts --email toi@exemple.fr https://ton-domaine');
    process.exit(1);
}

const {db, sql, migrate} = createDb(databaseUrl);
await migrate();

let [user] = await db.select().from(users).where(eq(users.email, email));
if (!user) {
    [user] = await db.insert(users).values({email}).returning();
    console.log(`Compte créé : ${email}`);
}

/** Business rows in a workspace, counted inside its own context since row-level security applies here too. */
async function rowCount(workspaceId: string): Promise<number> {
    return db.transaction(async (tx) => {
        await tx.execute(dsql`select set_config('app.workspace_id', ${workspaceId}, true)`);
        let total = 0;
        for (const table of WORKSPACE_TABLES) {
            const [row] = (await tx.execute(
                dsql`select count(*)::int as n from ${dsql.identifier(table)}`,
            )) as unknown as {n: number}[];
            total += row.n;
        }
        return total;
    });
}

const legacyOwners = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, LEGACY_WORKSPACE_ID));
const memberships = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id));
if (legacyOwners.length === 0) {
    // The account may already exist with its own workspace (signed up in the app): only replace it
    // with the legacy workspace when it is empty, so nothing is lost.
    const own = memberships.filter((m) => m.workspaceId !== LEGACY_WORKSPACE_ID);
    for (const m of own) {
        const n = await rowCount(m.workspaceId);
        if (n > 0) {
            console.error(
                `Ce compte a déjà un espace contenant ${n} élément(s) : rattachement annulé pour ne rien perdre.`,
            );
            console.error('Utilise une autre adresse pour reprendre les données historiques.');
            await sql.end();
            process.exit(1);
        }
    }
    await db.transaction(async (tx) => {
        if (own.length)
            await tx.delete(workspaces).where(
                inArray(
                    workspaces.id,
                    own.map((m) => m.workspaceId),
                ),
            );
        await tx.insert(workspaceMembers).values({workspaceId: LEGACY_WORKSPACE_ID, userId: user.id, role: 'owner'});
    });
    if (own.length) console.log('Espace vide créé à l’inscription remplacé.');
    console.log('Espace historique (données existantes) rattaché à ce compte.');
} else if (memberships.length === 0) {
    console.error('Ce compte n’a aucun espace : utilise plutôt l’inscription depuis l’application.');
    await sql.end();
    process.exit(1);
} else if (!legacyOwners.some((m) => m.userId === user.id)) {
    console.log('L’espace historique appartient déjà à un autre compte : seul un lien d’accès est généré.');
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
