import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';

export async function parseJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'JSON invalide' });
  }
  const res = schema.safeParse(body);
  if (!res.success) {
    const msg = res.error.issues.map((i) => `${i.path.join('.') || 'body'} : ${i.message}`).join(' ; ');
    throw new HTTPException(400, { message: msg });
  }
  return res.data;
}

export function notFound(): never {
  throw new HTTPException(404, { message: 'Introuvable' });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(c: Context, name = 'id'): string {
  const v = c.req.param(name);
  if (!v || !UUID_RE.test(v)) notFound();
  return v;
}
