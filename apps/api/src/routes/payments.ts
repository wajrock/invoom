import {eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';
import {HTTPException} from 'hono/http-exception';
import {invoiceFiles, payments} from '../db/schema.ts';
import type {Deps} from '../deps.ts';
import {notFound, parseJson, uuidParam} from '../lib/http.ts';
import {listPayments, type FileMeta} from '../lib/store.ts';
import {paymentSchema, type PaymentData} from '../lib/types.ts';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Détection du type réel à partir des premiers octets (on ne fait pas confiance au navigateur). */
function sniffMime(buf: Buffer): string | null {
    if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP')
        return 'image/webp';
    return null;
}

function split(body: ReturnType<typeof paymentSchema.parse>) {
    const {issuedOn, paidOn, ...data} = body;
    return {issuedOn, paidOn, data: data satisfies PaymentData};
}

export const paymentRoutes = (deps: Deps) => {
    const {db, cipher} = deps;
    const getOne = async (id: string) => (await listPayments(deps)).find((p) => p.id === id) ?? notFound();

    return new Hono()
        .get('/', async (c) => c.json((await listPayments(deps)).reverse()))
        .post('/', async (c) => {
            const {issuedOn, paidOn, data} = split(await parseJson(c, paymentSchema));
            const [row] = await db
                .insert(payments)
                .values({issuedOn, paidOn, data: cipher.encryptJson(data)})
                .returning();
            return c.json(await getOne(row.id), 201);
        })
        .put('/:id', async (c) => {
            const id = uuidParam(c);
            const {issuedOn, paidOn, data} = split(await parseJson(c, paymentSchema));
            const [row] = await db.select({data: payments.data}).from(payments).where(eq(payments.id, id));
            if (!row) notFound();
            // La facture générée n'est pas modifiable par ce formulaire : on la conserve telle quelle
            const {invoice} = cipher.decryptJson<PaymentData>(row.data);
            await db
                .update(payments)
                .set({
                    issuedOn,
                    paidOn,
                    data: cipher.encryptJson({...data, invoice: invoice ?? null} satisfies PaymentData),
                })
                .where(eq(payments.id, id));
            return c.json(await getOne(id));
        })
        .delete('/:id', async (c) => {
            await db.delete(payments).where(eq(payments.id, uuidParam(c)));
            return c.body(null, 204);
        })
        .post(
            '/:id/files',
            bodyLimit({
                maxSize: MAX_FILE_BYTES + 64 * 1024,
                onError: (c) => c.json({error: 'Fichier trop volumineux (10 Mo max)'}, 413),
            }),
            async (c) => {
                const id = uuidParam(c);
                const [exists] = await db.select({id: payments.id}).from(payments).where(eq(payments.id, id));
                if (!exists) notFound();

                const form = await c.req.parseBody();
                const file = form['file'];
                const lang = form['lang'];
                if (!(file instanceof File)) throw new HTTPException(400, {message: 'Fichier manquant'});
                if (lang !== 'fr' && lang !== 'en' && lang !== 'other')
                    throw new HTTPException(400, {message: 'Langue invalide'});
                if (file.size > MAX_FILE_BYTES)
                    throw new HTTPException(413, {message: 'Fichier trop volumineux (10 Mo max)'});

                const buf = Buffer.from(await file.arrayBuffer());
                const mime = sniffMime(buf);
                if (!mime) throw new HTTPException(415, {message: 'Formats acceptés : PDF, PNG, JPEG, WebP'});

                const meta: FileMeta = {name: file.name.slice(0, 200) || 'facture', mime, size: buf.length};
                const [row] = await db
                    .insert(invoiceFiles)
                    .values({paymentId: id, lang, meta: cipher.encryptJson(meta), content: cipher.encrypt(buf)})
                    .returning({id: invoiceFiles.id});
                return c.json({id: row.id, lang, ...meta}, 201);
            },
        );
};

export const fileRoutes = ({db, cipher}: Deps) =>
    new Hono()
        .get('/:id', async (c) => {
            const [row] = await db
                .select()
                .from(invoiceFiles)
                .where(eq(invoiceFiles.id, uuidParam(c)));
            if (!row) notFound();
            const meta = cipher.decryptJson<FileMeta>(row.meta);
            const content = cipher.decrypt(row.content);
            const disposition = c.req.query('download') ? 'attachment' : 'inline';
            return c.body(new Uint8Array(content), 200, {
                'Content-Type': meta.mime,
                'Content-Length': String(content.length),
                'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
                'Cache-Control': 'private, no-store',
            });
        })
        .delete('/:id', async (c) => {
            await db.delete(invoiceFiles).where(eq(invoiceFiles.id, uuidParam(c)));
            return c.body(null, 204);
        });
