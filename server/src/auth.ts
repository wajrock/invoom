import { verify } from '@node-rs/argon2';
import { eq, lt } from 'drizzle-orm';
import { Hono, type MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Db } from './db/client.ts';
import { loginAttempts, sessions } from './db/schema.ts';
import { parseJson } from './lib/http.ts';

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const IP_MAX_FAILURES = 5;
const IP_BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 3600 * 1000;
/** Plafond global (toutes IP) contre les attaques distribuées */
const GLOBAL_MAX_FAILURES = 200;
const GLOBAL_WINDOW_MS = 24 * 3600 * 1000;
const GLOBAL_LOCK_MS = 60 * 60 * 1000;

export interface AuthOptions {
  db: Db;
  accessCodeHash: string;
  secureCookies: boolean;
  trustProxy: boolean;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function createAuth(opts: AuthOptions) {
  const { db } = opts;
  const cookieName = opts.secureCookies ? '__Host-fh_session' : 'fh_session';

  function clientIp(c: Parameters<MiddlewareHandler>[0]): string {
    if (opts.trustProxy) {
      const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
      if (fwd) return fwd;
    }
    return getConnInfo(c).remote.address ?? 'unknown';
  }

  async function lockedUntil(key: string): Promise<Date | null> {
    const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
    return row?.lockedUntil && row.lockedUntil > new Date() ? row.lockedUntil : null;
  }

  async function registerFailure(ip: string) {
    const now = new Date();
    // Par IP : verrouillage progressif (15 min, 30 min, 1 h… jusqu'à 24 h)
    const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, ip));
    const failures = (row?.failures ?? 0) + 1;
    let lockouts = row?.lockouts ?? 0;
    let locked: Date | null = null;
    if (failures >= IP_MAX_FAILURES) {
      lockouts += 1;
      locked = new Date(now.getTime() + Math.min(IP_BASE_LOCK_MS * 2 ** (lockouts - 1), MAX_LOCK_MS));
    }
    const ipValues = { failures: locked ? 0 : failures, lockouts, lockedUntil: locked, windowStart: now };
    await db
      .insert(loginAttempts)
      .values({ key: ip, ...ipValues })
      .onConflictDoUpdate({ target: loginAttempts.key, set: ipValues });

    // Global : fenêtre glissante de 24 h
    const [g] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, '*'));
    const expired = !g || now.getTime() - g.windowStart.getTime() > GLOBAL_WINDOW_MS;
    const gFailures = (expired ? 0 : g.failures) + 1;
    const gLocked = gFailures >= GLOBAL_MAX_FAILURES ? new Date(now.getTime() + GLOBAL_LOCK_MS) : null;
    const gValues = {
      failures: gLocked ? 0 : gFailures,
      lockouts: 0,
      lockedUntil: gLocked,
      windowStart: expired || gLocked ? now : g.windowStart,
    };
    await db
      .insert(loginAttempts)
      .values({ key: '*', ...gValues })
      .onConflictDoUpdate({ target: loginAttempts.key, set: gValues });
  }

  async function currentSession(c: Parameters<MiddlewareHandler>[0]) {
    const token = getCookie(c, cookieName);
    if (!token) return null;
    const [s] = await db.select().from(sessions).where(eq(sessions.id, sha256(token)));
    if (!s || s.expiresAt < new Date()) return null;
    return s;
  }

  const requireAuth: MiddlewareHandler = async (c, next) => {
    if (!(await currentSession(c))) return c.json({ error: 'Non authentifié' }, 401);
    await next();
  };

  const routes = new Hono()
    .post('/login', async (c) => {
      const { code } = await parseJson(c, z.object({ code: z.string().min(1).max(256) }));
      const ip = clientIp(c);
      const lock = (await lockedUntil(ip)) ?? (await lockedUntil('*'));
      if (lock) {
        const minutes = Math.ceil((lock.getTime() - Date.now()) / 60000);
        return c.json({ error: `Trop de tentatives. Réessaie dans ${minutes} min.` }, 429);
      }

      let ok = false;
      try {
        ok = await verify(opts.accessCodeHash, code);
      } catch {
        ok = false;
      }
      if (!ok) {
        await registerFailure(ip);
        return c.json({ error: 'Code incorrect' }, 401);
      }

      await db.delete(loginAttempts).where(eq(loginAttempts.key, ip));
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await db.insert(sessions).values({ id: sha256(token), expiresAt });
      setCookie(c, cookieName, token, {
        httpOnly: true,
        secure: opts.secureCookies,
        sameSite: 'Strict',
        path: '/',
        expires: expiresAt,
      });
      return c.json({ ok: true });
    })
    .post('/logout', async (c) => {
      const token = getCookie(c, cookieName);
      if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
      deleteCookie(c, cookieName, { path: '/', secure: opts.secureCookies });
      return c.json({ ok: true });
    })
    .get('/me', async (c) => {
      const s = await currentSession(c);
      return c.json({ authenticated: !!s, expiresAt: s?.expiresAt ?? null });
    });

  return { routes, requireAuth };
}
