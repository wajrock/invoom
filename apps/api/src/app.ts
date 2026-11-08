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
import {simulatorRoutes} from './modules/simulator/simulator.routes.ts';

function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
    if (!origin || !host) return false;
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

export interface AppOptions extends Omit<AuthOptions, 'db'> {
    /** Built web app to serve (production). */
    staticDir?: string;
    /** Port of the Angular dev server that non-API visits are redirected to (development). */
    devWebPort?: number;
}

/** Angular output file names carry a content hash, so they can be cached forever. */
const HASHED_ASSET = /-[A-Za-z0-9_]{8}\.(?:js|css)$/;

/** Static files plus the single-page-app fallback. */
function serveWebApp(app: Hono, dir: string) {
    const indexPath = join(dir, 'index.html');
    if (!existsSync(indexPath)) throw new Error(`STATIC_DIR has no index.html: ${dir}`);
    const indexHtml = readFileSync(indexPath, 'utf8');
    app.use(
        '*',
        serveStatic({
            root: relative(process.cwd(), dir),
            onFound: (path, c) => {
                c.header('Cache-Control', HASHED_ASSET.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache');
            },
        }),
    );
    app.get('*', (c) => {
        // A missing script or stylesheet must fail as such, not come back as HTML (blank page)
        if (/\.[a-z0-9]+$/i.test(c.req.path)) return c.notFound();
        c.header('Cache-Control', 'no-cache');
        return c.html(indexHtml);
    });
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
    api.route('/simulator', simulatorRoutes(deps));
    app.route('/api', api);
    app.all('/api/*', (c) => c.json({error: 'Introuvable'}, 404));

    if (opts.staticDir) {
        serveWebApp(app, resolve(opts.staticDir));
    } else if (opts.devWebPort) {
        // In development the Angular dev server serves the web app with live reload: send stray visits there
        const port = String(opts.devWebPort);
        app.get('*', (c) => {
            const url = new URL(c.req.url);
            url.port = port;
            return c.redirect(url.toString());
        });
    }

    return app;
}
