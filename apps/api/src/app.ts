import {Hono} from 'hono';
import {serveStatic} from '@hono/node-server/serve-static';
import {HTTPException} from 'hono/http-exception';
import {secureHeaders} from 'hono/secure-headers';
import {existsSync, readFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {createAuth, type AuthOptions} from './modules/auth/auth.module.ts';
import type {Db} from './db/client.ts';
import {scopedDeps} from './db/workspace-scope.ts';
import {clientRoutes} from './modules/clients/clients.routes.ts';
import {companyRoutes} from './modules/company/company.routes.ts';
import {dashboardRoutes} from './modules/dashboard/dashboard.routes.ts';
import {deadlineRoutes} from './modules/deadlines/deadlines.routes.ts';
import {invoiceRoutes} from './modules/invoices/invoices.routes.ts';
import {fileRoutes} from './modules/payments/files.routes.ts';
import {paymentRoutes} from './modules/payments/payments.routes.ts';
import {platformRoutes} from './modules/platforms/platforms.routes.ts';
import {serviceRoutes} from './modules/services/services.routes.ts';
import {settingsRoutes} from './modules/settings/settings.routes.ts';

function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
    if (!origin || !host) return false;
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

export interface AppOptions extends Omit<AuthOptions, 'db'> {
    staticDir?: string;
}

/**
 * `db` is used by authentication (account tables). Business routes receive dependencies bound to
 * the session's workspace (transaction, row-level security, workspace key): see db/workspace-scope.ts.
 */
export function createApp(db: Db, opts: AppOptions) {
    const auth = createAuth({...opts, db});
    const deps = scopedDeps;
    const app = new Hono();

    app.use(
        '*',
        secureHeaders({
            contentSecurityPolicy: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:', 'https://icons.duckduckgo.com'],
                connectSrc: ["'self'"],
                frameSrc: ["'self'", 'blob:'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                frameAncestors: ["'self'"],
                formAction: ["'self'"],
            },
            xFrameOptions: 'SAMEORIGIN',
            referrerPolicy: 'no-referrer',
        }),
    );
    // Reject state-changing requests from another origin (on top of the SameSite=Strict cookie)
    app.use('/api/*', async (c, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
            const origin = c.req.header('origin') ?? c.req.header('referer');
            const host = c.req.header('x-forwarded-host') ?? c.req.header('host');
            if (!isSameOrigin(origin, host)) return c.json({error: 'Origine refusée'}, 403);
        }
        await next();
    });

    app.onError((err, c) => {
        if (err instanceof HTTPException) return c.json({error: err.message}, err.status);
        console.error(err);
        return c.json({error: 'Erreur serveur'}, 500);
    });

    app.get('/api/health', (c) => c.json({ok: true}));
    app.route('/api/auth', auth.routes);

    const api = new Hono();
    api.use('*', auth.requireAuth);
    api.route('/company', companyRoutes(deps));
    api.route('/settings', settingsRoutes(deps));
    api.route('/platforms', platformRoutes(deps));
    api.route('/clients', clientRoutes(deps));
    api.route('/invoices', invoiceRoutes(deps));
    api.route('/services', serviceRoutes(deps));
    api.route('/payments', paymentRoutes(deps));
    api.route('/files', fileRoutes(deps));
    api.route('/deadlines', deadlineRoutes(deps));
    api.route('/dashboard', dashboardRoutes(deps));
    app.route('/api', api);
    app.all('/api/*', (c) => c.json({error: 'Introuvable'}, 404));

    // Front Angular (production) : fichiers statiques + fallback SPA
    const staticDir = opts.staticDir ? resolve(opts.staticDir) : null;
    if (staticDir && existsSync(join(staticDir, 'index.html'))) {
        const indexHtml = readFileSync(join(staticDir, 'index.html'), 'utf8');
        app.use('*', serveStatic({root: relative(process.cwd(), staticDir)}));
        app.get('*', (c) => c.html(indexHtml));
    }

    return app;
}
