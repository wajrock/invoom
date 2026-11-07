/**
 * Outil d'administration : lien d'accès pour un compte, valable 30 minutes et utilisable une seule fois.
 *
 *   node scripts/enroll.ts --email toi@exemple.fr https://ton-domaine
 *
 * - Crée le compte s'il n'existe pas.
 * - S'il n'a pas encore de propriétaire, l'espace historique (données d'avant le multi-utilisateur)
 *   est rattaché à ce compte : c'est ainsi que l'on reprend ses données après la migration.
 * - Affiche un lien qui permet de créer une passkey sur l'appareil qui l'ouvre.
 *
 * Sert aussi de dernier recours si un utilisateur n'a plus ni appareil, ni code, ni accès à sa boîte mail.
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
} from '../src/db/schema.ts';
import {databaseUrl} from '../src/env.ts';
import {generateEmailToken, hashEmailToken} from '../src/lib/recovery.ts';

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

/** Nombre de lignes métier d'un espace (lu dans son propre contexte, la RLS s'appliquant aussi ici). */
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
    // Le compte a peut-être déjà été créé depuis l'application, avec son propre espace : on ne le
    // remplace par l'espace historique que s'il est vide (sinon on refuse, pour ne rien perdre).
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
        // Les sessions ouvertes sur l'ancien espace (vide) sont supprimées avec lui
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
