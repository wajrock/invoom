import {Hono} from 'hono';
import type {Deps} from '../../core/deps.ts';
import {parseJson} from '../../core/http.ts';
import {putSetting} from '../settings/settings.store.ts';
import {companySchema} from './company.schema.ts';
import {getCompany} from './company.store.ts';

export const companyRoutes = (deps: Deps) =>
    new Hono()
        .get('/', async (c) => c.json(await getCompany(deps)))
        .put('/', async (c) => {
            const body = await parseJson(c, companySchema);
            await putSetting(deps, 'company', body);
            return c.json(body);
        });
