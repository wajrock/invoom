import {eq} from 'drizzle-orm';
import {Hono} from 'hono';
import type {Deps} from '../../core/deps.ts';
import {notFound, uuidParam} from '../../core/http.ts';
import {invoiceFiles} from '../../db/schema/index.ts';
import type {FileMeta} from './payments.store.ts';

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
