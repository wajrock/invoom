import {eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';
import {HTTPException} from 'hono/http-exception';
import {invoiceFiles, payments} from '../../db/schema/index.ts';
import type {Deps} from '../../core/deps.ts';
import {notFound, parseJson, uuidParam} from '../../core/http.ts';
import {listPayments, type FileMeta} from './payments.store.ts';
import {MAX_FILE_BYTES, sniffMime} from './file-type.ts';
import {paymentSchema, type PaymentData} from './payment.schema.ts';

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
            // This form can't edit a generated invoice, so it is kept as is
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
